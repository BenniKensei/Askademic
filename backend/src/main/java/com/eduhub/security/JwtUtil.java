package com.eduhub.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    private static final String SECRET = "mySecretKeyForJwtTokenGenerationThatIsLongEnough";
    private static final long EXPIRATION_TIME = 86400000; // 1 day

    /**
     * Why:
     * HS256 with a single signing key keeps token verification cheap for each request.
     * One-day expiration balances user convenience with breach containment for this app.
     */
    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(SECRET.getBytes());
    }

    /**
     * Token contract:
     * - sub: email
     * - role: authorization claim consumed by the frontend
     * - userId: explicit numeric id for ownership checks without profile fetch
     */
    public String generateToken(String email, String role, Integer userId) {
        return Jwts.builder()
                .setSubject(email)
                .claim("role", role)
                .claim("userId", userId)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractEmail(String token) {
        return Jwts.parserBuilder().setSigningKey(getSigningKey()).build()
                .parseClaimsJws(token).getBody().getSubject();
    }

    public String extractRole(String token) {
        return Jwts.parserBuilder().setSigningKey(getSigningKey()).build()
                .parseClaimsJws(token).getBody().get("role", String.class);
    }

    public boolean isTokenExpired(String token) {
        return Jwts.parserBuilder().setSigningKey(getSigningKey()).build()
                .parseClaimsJws(token).getBody().getExpiration().before(new Date());
    }

    public boolean validateToken(String token, String email) {
        // # TODO: also validate issuer/audience once multi-client support is introduced.
        // # FIXME: move SECRET/EXPIRATION_TIME to external configuration to avoid hard-coded credentials.
        return (email.equals(extractEmail(token)) && !isTokenExpired(token));
    }
}
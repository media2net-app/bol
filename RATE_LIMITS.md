# Bol.com API Rate Limits

## Overzicht

Deze applicatie gebruikt de officiële rate limit informatie van bol.com om API calls te optimaliseren en rate limit errors te voorkomen.

**Bron:** [https://api.bol.com/retailer/public/ratelimits](https://api.bol.com/retailer/public/ratelimits)

## Belangrijkste Rate Limits

### Orders
- **GET /retailer/orders**: 25 requests per minuut
- **GET /retailer/orders/{id}**: 25 requests per seconde

### Shipments
- **GET /retailer/shipments**: 25 requests per minuut
- **POST /retailer/shipments**: 25 requests per seconde
- **GET /retailer/shipments/{id}**: 50 requests per minuut

### Returns
- **GET /retailer/returns**: 20 requests per minuut
- **POST /retailer/returns**: 20 requests per minuut

### Offers
- **GET /retailer/offers**: 25 requests per seconde
- **POST /retailer/offers**: 50 requests per seconde
- **POST /retailer/offers/export**: 9 requests per uur (zeer beperkt!)

### Invoices
- **GET /retailer/invoices**: 24 requests per minuut

### Commissions
- **GET /retailer/commission/{id}**: 28 requests per seconde

### Performance
- **GET /retailer/insights/performance/indicator**: 20 requests per minuut

## Implementatie

### Automatische Cache TTL
De applicatie berekent automatisch de optimale cache TTL op basis van rate limits:
- Cache TTL = 80% van de rate limit time window
- Dit voorkomt dat we te vaak dezelfde data ophalen

### Voorbeelden

**Orders (25/min)**
- Cache TTL: ~48 seconden (80% van 60 seconden)
- Veilig request interval: ~2.4 seconden

**Offers Export (9/uur)**
- Cache TTL: ~48 minuten (80% van 60 minuten)
- Veilig request interval: ~6.7 minuten

**Shipments (25/min)**
- Cache TTL: ~48 seconden
- Veilig request interval: ~2.4 seconden

## API Endpoint

Je kunt rate limit informatie opvragen via:
```
GET /api/ratelimits?endpoint=/retailer/orders&method=GET
```

Response:
```json
{
  "success": true,
  "data": {
    "rateLimit": {
      "path": "/retailer/orders",
      "methods": "GET, OPTIONS, HEAD",
      "maxCapacity": 25,
      "timeToLive": 1,
      "timeUnit": "MINUTES"
    },
    "optimalCacheTTL": 48000,
    "optimalCacheTTLMinutes": 0.8,
    "safeRequestInterval": 2400,
    "safeRequestIntervalSeconds": 2.4,
    "info": "25 requests per 1 minuut/minuten"
  }
}
```

## Best Practices

1. **Gebruik caching**: Alle GET requests worden automatisch gecached
2. **Respecteer rate limits**: De applicatie berekent automatisch veilige intervals
3. **Offers Export**: Gebruik spaarzaam (9 requests per uur!)
4. **Batch requests**: Combineer waar mogelijk meerdere requests

## Monitoring

De applicatie toont automatisch rate limit warnings wanneer:
- Rate limit wordt bereikt (429 error)
- Cache wordt gebruikt als fallback
- Retry-after tijd wordt getoond


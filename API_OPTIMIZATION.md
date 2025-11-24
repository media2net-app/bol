# API Optimalisatie - Rate Limiting & Token Management

## 🎯 Problemen Opgelost

### 1. Expired JWT Tokens (401)
- **Probleem**: Tokens expireerden zonder automatische refresh
- **Oplossing**: 
  - Token caching met expiration tracking
  - Automatische token refresh bij 401 errors
  - 60 seconden buffer voor token expiration

### 2. Rate Limiting (429)
- **Probleem**: Te veel API calls leidden tot rate limits
- **Oplossing**:
  - Response caching per endpoint type
  - Slimme polling met `change-interval-minute`
  - Verschillende TTL per endpoint type

## 🔧 Implementatie

### Token Caching (`lib/tokenCache.ts`)
- Cached tokens met expiration tijd
- Automatische validatie met 60s buffer
- Clear functie voor logout/errors

### API Response Caching (`lib/apiCache.ts`)
- Caches GET responses per endpoint
- Verschillende TTL per endpoint type:
  - Orders: 5 minuten
  - Shipments: 10 minuten
  - Returns: 10 minuten
  - Invoices: 1 uur
  - Offers: 15 minuten
  - Products: 30 minuten
  - Performance: 1 uur

### Slimme Polling
- Gebruik `change-interval-minute` parameter voor orders
- Haalt alleen nieuwe/gewijzigde orders op
- Minimaliseert data transfer en API calls

## 📊 Best Practices

### 1. Polling Frequentie
```typescript
// Goed: Gebruik change-interval-minute
const changeInterval = 15 // Minuten
const orders = await makeBolApiRequest(
  `/retailer/orders?change-interval-minute=${changeInterval}`
)

// Slecht: Haal alle orders op zonder filter
const orders = await makeBolApiRequest('/retailer/orders')
```

### 2. Cache Gebruik
```typescript
// Automatisch gecached voor GET requests
const data = await makeBolApiRequest('/retailer/orders', {}, true)

// Force refresh (skip cache)
const data = await makeBolApiRequest('/retailer/orders', {}, false)
```

### 3. Token Management
- Tokens worden automatisch gecached
- Automatische refresh bij expiration
- Geen handmatige token management nodig

## 🛠️ Cache Beheer

### Cache Statistieken
```bash
GET /api/optimize?action=stats
```

### Cache Clearen
```bash
# Clear alle cache
GET /api/optimize?action=clear-cache

# Clear specifieke endpoint
GET /api/optimize?action=clear-cache&endpoint=/retailer/orders
```

### Token Refresh
```bash
GET /api/optimize?action=clear-token
```

## ⚡ Optimalisatie Tips

1. **Gebruik change-interval-minute**: Alleen nieuwe/gewijzigde data ophalen
2. **Cache strategisch**: Verschillende TTL per endpoint type
3. **Batch requests**: Combineer waar mogelijk
4. **Polling interval**: Pas aan op basis van je behoeften (5-15 minuten)
5. **Monitor cache**: Gebruik stats endpoint om cache efficiency te monitoren

## 📈 Verwachte Verbetering

- **Token requests**: ~95% reductie (van elke request naar 1x per uur)
- **API calls**: ~70-80% reductie door caching
- **Rate limits**: Significante vermindering door slimme polling
- **Performance**: Snellere response times door caching

## 🔍 Monitoring

Check cache efficiency:
```typescript
const stats = await fetch('/api/optimize?action=stats')
console.log(stats) // { size: 5, keys: [...] }
```


# BOL.com Retailer API Expert Guide

**Complete setup en implementatie handleiding voor alle BOL.com Retailer API v10 endpoints**

> **Bron**: https://api.bol.com/retailer/public/Retailer-API/index.html  
> **Versie**: Retailer API v10  
> **Laatste update**: 2025-11-23

---

## 📋 Inhoudsopgave

1. [Authenticatie Setup](#authenticatie-setup)
2. [Orders API](#orders-api)
3. [Offers API](#offers-api)
4. [Shipments API](#shipments-api)
5. [Returns API](#returns-api)
6. [Invoices API](#invoices-api)
7. [Commissions API](#commissions-api)
8. [Inventory API (Voorraad)](#inventory-api-voorraad)
9. [Replenishments API](#replenishments-api)
10. [Products API](#products-api)
11. [Product Content API](#product-content-api)
12. [Performance Indicators API](#performance-indicators-api)
13. [Promotions API](#promotions-api)
14. [Retailers API](#retailers-api)
15. [Shipping Labels API](#shipping-labels-api)
16. [Subscriptions API](#subscriptions-api)
17. [Process Status API](#process-status-api)
18. [Rate Limits Overzicht](#rate-limits-overzicht)
19. [Best Practices](#best-practices)

---

## 🔐 Authenticatie Setup

### OAuth 2.0 Client Credentials Flow

**Endpoint**: `https://login.bol.com/token`

**Methode**: `POST`

**Headers**:
```http
Authorization: Basic {base64(clientId:clientSecret)}
Content-Type: application/x-www-form-urlencoded
Accept: application/json
```

**Body**:
```
grant_type=client_credentials
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Implementatie in Code

```typescript
// lib/api.ts
const BOL_TOKEN_URL = 'https://login.bol.com/token'

export async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getApiCredentials()
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  
  const response = await fetch(BOL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: 'grant_type=client_credentials',
  })
  
  const data = await response.json()
  return data.access_token
}
```

### API Request Headers

Voor alle API calls:
```http
Authorization: Bearer {access_token}
Accept: application/vnd.retailer.v10+json
Content-Type: application/vnd.retailer.v10+json
```

### Token Caching

- **Token geldigheid**: 1 uur (3600 seconden)
- **Cache buffer**: 5 minuten voor refresh
- **Automatische refresh**: Bij 401 errors

---

## 📦 Orders API

### Endpoint: `/retailer/orders`

**Rate Limit**: 25 requests per minuut (GET)

### GET - Lijst van orders ophalen

**Endpoint**: `GET /retailer/orders`

**Query Parameters**:
- `page` (number): Paginanummer (default: 1)
- `fulfilment-method` (string): `FBR`, `FBB`, of `ALL` (default: `ALL`)
- `status` (string): `OPEN`, `SHIPPED`, `CANCELLED` (default: `OPEN`)
- `change-interval-minute` (number): Alleen orders ophalen die gewijzigd zijn in laatste X minuten

**Voorbeeld**:
```typescript
// app/api/orders/route.ts
const orders = await makeBolApiRequest(
  '/retailer/orders?fulfilment-method=ALL&status=OPEN&change-interval-minute=60',
  {},
  true // Use cache
)
```

**Response Structuur**:
```json
{
  "orders": [
    {
      "orderId": "1234567890",
      "orderPlacedDateTime": "2025-11-23T10:00:00Z",
      "orderItems": [...],
      "shipmentDetails": {...},
      "billingDetails": {...}
    }
  ]
}
```

### GET - Specifieke order ophalen

**Endpoint**: `GET /retailer/orders/{order-id}`

**Rate Limit**: 25 requests per seconde

**Voorbeeld**:
```typescript
// app/api/orders/[orderId]/route.ts
const orderDetails = await makeBolApiRequest(`/retailer/orders/${orderId}`)
```

**Response**: Volledige order details inclusief:
- Order informatie
- Order items (EAN, quantity, price, commission)
- Customer details
- Billing details
- Shipment details
- Fulfilment method
- Latest change date
- Expiry date

### Implementatie Checklist

- [x] Orders lijst ophalen met filters
- [x] Order details ophalen per ID
- [x] Change-interval-minute gebruiken voor optimalisatie
- [x] Caching implementeren (5 minuten TTL)
- [x] Rate limit handling

---

## 🛍️ Offers API

### Endpoint: `/retailer/offers`

**Rate Limits**:
- GET: 25 requests per seconde
- POST: 50 requests per seconde
- PUT/DELETE: 50 requests per seconde
- Export: 9 requests per uur ⚠️ (zeer beperkt!)

### GET - Offer ophalen

**Endpoint**: `GET /retailer/offers/{offer-id}`

**Voorbeeld**:
```typescript
// lib/api.ts
export async function getOffer(offerId: string) {
  return makeBolApiRequest(`/retailer/offers/${offerId}`)
}
```

### POST - Offer aanmaken/bijwerken

**Endpoint**: `POST /retailer/offers`

**Body**:
```json
{
  "ean": "8712626055140",
  "condition": {
    "name": "NEW",
    "category": "NEW"
  },
  "pricing": {
    "bundlePrices": [
      {
        "quantity": 1,
        "unitPrice": 19.99
      }
    ]
  },
  "stock": {
    "amount": 10,
    "managedByRetailer": true
  },
  "onHoldByRetailer": false,
  "unknownProductTitle": "Product titel"
}
```

### PUT - Offer bijwerken

**Endpoint**: `PUT /retailer/offers/{offer-id}`

### DELETE - Offer verwijderen

**Endpoint**: `DELETE /retailer/offers/{offer-id}`

### POST - Offers Export (Asynchroon)

**Endpoint**: `POST /retailer/offers/export`

**⚠️ WAARSCHUWING**: Zeer beperkte rate limit (9 requests per uur!)

**Proces**:
1. POST naar `/retailer/offers/export` → krijg `processStatusId`
2. Poll `/retailer/process-status/{processStatusId}` tot status `SUCCESS`
3. Haal export op via `GET /retailer/offers/export/{export-id}`

**Voorbeeld**:
```typescript
// app/api/offers/route.ts

// 1. Start export
const exportResponse = await makeBolApiRequest(
  '/retailer/offers/export',
  { 
    method: 'POST',
    body: JSON.stringify({ format: 'CSV' }) // Required: format field must be "CSV"
  },
  false // Don't cache POST
)

const processStatusId = exportResponse.processStatusId

// 2. Poll process status
let status = await getProcessStatus(processStatusId)
while (status.status === 'PENDING') {
  await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
  status = await getProcessStatus(processStatusId)
}

// 3. Get export file
if (status.status === 'SUCCESS') {
  const exportId = status.entityId
  const exportData = await makeBolApiRequest(`/retailer/offers/export/${exportId}`)
}
```

### Implementatie Checklist

- [x] Offer ophalen per ID
- [x] Offer aanmaken (POST)
- [x] Offer bijwerken (PUT)
- [x] Offer verwijderen (DELETE)
- [x] Offers export (asynchroon proces)
- [x] Process status polling
- [x] Rate limit handling (vooral voor export!)

---

## 🚚 Shipments API

### Endpoint: `/retailer/shipments`

**Rate Limits**:
- GET: 25 requests per minuut
- POST: 25 requests per seconde
- GET by ID: 50 requests per minuut

### GET - Lijst van verzendingen

**Endpoint**: `GET /retailer/shipments`

**Query Parameters**:
- `page` (number): Paginanummer
- `fulfilment-method` (string): `FBR`, `FBB`, of `ALL`

**Voorbeeld**:
```typescript
// app/api/shipments/route.ts
const shipments = await makeBolApiRequest(
  `/retailer/shipments?page=${page}&fulfilment-method=${fulfilmentMethod}`,
  {},
  true // Use cache
)
```

**Response**:
```json
{
  "shipments": [
    {
      "shipmentId": "1234567890",
      "shipmentDate": "2025-11-23T10:00:00Z",
      "shipmentReference": "REF123",
      "transport": {...},
      "orderItems": [...]
    }
  ]
}
```

### GET - Specifieke verzending

**Endpoint**: `GET /retailer/shipments/{shipment-id}`

### POST - Nieuwe verzending aanmaken

**Endpoint**: `POST /retailer/shipments`

**Body**:
```json
{
  "orderItems": [
    {
      "orderItemId": "1234567890"
    }
  ],
  "shipmentReference": "REF123",
  "transport": {
    "transportId": "3-TNT-123456"
  }
}
```

### PUT - Transport informatie toevoegen

**Endpoint**: `PUT /retailer/shipments/{shipment-id}/transport`

**Body**:
```json
{
  "transportId": "3-TNT-123456",
  "transporterCode": "TNT"
}
```

### Implementatie Checklist

- [x] Verzendingen lijst ophalen
- [x] Specifieke verzending ophalen
- [x] Nieuwe verzending aanmaken
- [x] Transport informatie toevoegen
- [x] Caching implementeren

---

## ↩️ Returns API

### Endpoint: `/retailer/returns`

**Rate Limit**: 20 requests per minuut

### GET - Lijst van retouren

**Endpoint**: `GET /retailer/returns`

**Query Parameters**:
- `page` (number): Paginanummer
- `fulfilment-method` (string): `FBR`, `FBB`, of `ALL`
- `handled` (boolean): Gefilterd op afgehandeld/onafgehandeld

**Voorbeeld**:
```typescript
// app/api/returns/route.ts
const returns = await makeBolApiRequest(
  `/retailer/returns?page=${page}&fulfilment-method=${fulfilmentMethod}`,
  {},
  true // Use cache
)
```

**Response**:
```json
{
  "returns": [
    {
      "returnId": "1234567890",
      "returnNumber": "RET123",
      "registrationDateTime": "2025-11-23T10:00:00Z",
      "fulfilmentMethod": "FBR",
      "returnItems": [...]
    }
  ]
}
```

### GET - Specifieke retour

**Endpoint**: `GET /retailer/returns/{return-id}`

### PUT - Retour verwerken

**Endpoint**: `PUT /retailer/returns/{return-id}`

**Body**:
```json
{
  "handled": true,
  "handledDateTime": "2025-11-23T10:00:00Z"
}
```

### Implementatie Checklist

- [x] Retouren lijst ophalen
- [x] Specifieke retour ophalen
- [x] Retour verwerken (PUT)
- [x] Caching implementeren

---

## 🧾 Invoices API

### Endpoint: `/retailer/invoices`

**Rate Limit**: 24 requests per minuut

### GET - Lijst van facturen

**Endpoint**: `GET /retailer/invoices`

**Query Parameters**:
- `period-start-date` (string): Startdatum (ISO 8601)
- `period-end-date` (string): Einddatum (ISO 8601)
- `page` (number): Paginanummer

**Voorbeeld**:
```typescript
// app/api/invoices/route.ts
const invoices = await makeBolApiRequest(
  `/retailer/invoices?period-start-date=${startDate}&period-end-date=${endDate}&page=${page}`,
  {},
  true // Use cache
)
```

**Response**:
```json
{
  "invoices": [
    {
      "invoiceId": "1234567890",
      "invoiceDate": "2025-11-23",
      "invoiceNumber": "INV123",
      "totalAmount": 1000.00,
      "currency": "EUR"
    }
  ]
}
```

### GET - Specifieke factuur

**Endpoint**: `GET /retailer/invoices/{invoice-id}`

### Implementatie Checklist

- [x] Facturen lijst ophalen met datum filters
- [x] Specifieke factuur ophalen
- [x] Caching implementeren (30 minuten TTL - facturen veranderen niet vaak)

---

## 💰 Commissions API

### Endpoint: `/retailer/commissions`

**Rate Limit**: 28 requests per seconde

### POST - Commissie opvragen

**Endpoint**: `POST /retailer/commissions`

**Body**:
```json
{
  "ean": "8712626055140",
  "condition": {
    "name": "NEW",
    "category": "NEW"
  },
  "unitPrice": 19.99
}
```

**Voorbeeld**:
```typescript
// app/api/commissions/route.ts
const commission = await makeBolApiRequest(
  '/retailer/commissions',
  {
    method: 'POST',
    body: JSON.stringify({
      ean: ean,
      condition: { name: condition, category: condition },
      unitPrice: parseFloat(unitPrice)
    })
  },
  false // Don't cache POST
)
```

**Response**:
```json
{
  "commission": {
    "fixedAmount": 0.50,
    "percentage": 12.5,
    "totalCost": 2.50,
    "totalCostWithoutReduction": 2.50
  }
}
```

### GET - Commissie opvragen (alternatief)

**Endpoint**: `GET /retailer/commission/{ean}/{condition}`

**Voorbeeld**:
```typescript
const commission = await makeBolApiRequest(
  `/retailer/commission/${ean}/${condition}?unitPrice=${unitPrice}`
)
```

### Implementatie Checklist

- [x] Commissie berekenen via POST
- [x] Commissie ophalen via GET
- [x] Error handling voor ongeldige EAN/condition

---

## 📊 Inventory API (Voorraad)

### Endpoint: `/retailer/inventory`

**Rate Limit**: 20 requests per minuut

### GET - Voorraad ophalen

**Endpoint**: `GET /retailer/inventory`

**Query Parameters**:
- `page` (number): Paginanummer
- `quantity` (string): Filter op voorraad niveau (`0`, `1-10`, `11-25`, `26-50`, `51-250`, `251+`)

**Voorbeeld**:
```typescript
// app/api/inventory/route.ts
const inventory = await makeBolApiRequest(
  `/retailer/inventory?page=${page}&quantity=${quantity}`,
  {},
  true // Use cache
)
```

**Response**:
```json
{
  "inventory": [
    {
      "ean": "8712626055140",
      "bsku": "BSKU123",
      "gradedStock": 10,
      "regularStock": 5,
      "title": "Product naam"
    }
  ]
}
```

### FBR vs FBB

- **FBR (Fulfilled by Retailer)**: Jij beheert de voorraad en verzending
- **FBB (Fulfilled by bol)**: bol.com beheert de voorraad en verzending

### Implementatie Checklist

- [x] Voorraad ophalen met filters
- [x] FBR/FBB onderscheid maken
- [x] Caching implementeren

---

## 📦 Replenishments API

### Endpoint: `/retailer/replenishments`

**Rate Limit**: 20 requests per minuut

### GET - FBB Aanvullingen

**Endpoint**: `GET /retailer/replenishments`

**Query Parameters**:
- `page` (number): Paginanummer
- `state` (string): `ANNOUNCED`, `IN_TRANSIT`, `ARRIVED_AT_FC`, `IN_PROGRESS_AT_FC`, `CANCELLED`

**Voorbeeld**:
```typescript
// app/api/replenishments/route.ts
const replenishments = await makeBolApiRequest(
  `/retailer/replenishments?page=${page}&state=${state}`,
  {},
  true // Use cache
)
```

**Response**:
```json
{
  "replenishments": [
    {
      "replenishmentId": "1234567890",
      "creationDateTime": "2025-11-23T10:00:00Z",
      "reference": "REF123",
      "labelingByBol": true,
      "state": "IN_TRANSIT",
      "deliveryInformation": {...},
      "loadCarriers": [...]
    }
  ]
}
```

### GET - Specifieke aanvulling

**Endpoint**: `GET /retailer/replenishments/{replenishment-id}`

### Implementatie Checklist

- [x] Aanvullingen lijst ophalen
- [x] Specifieke aanvulling ophalen
- [x] State filtering
- [x] Caching implementeren

---

## 🔍 Products API

### Endpoint: `/retailer/products`

**Rate Limits**:
- POST `/retailer/products/list`: 50 requests per minuut
- GET `/retailer/products/*`: 50 requests per minuut

### POST - Producten zoeken

**Endpoint**: `POST /retailer/products/list`

**Body**:
```json
{
  "ean": "8712626055140"
}
```

Of:
```json
{
  "productIds": ["1234567890"]
}
```

Of:
```json
{
  "title": "zoekterm"
}
```

**Voorbeeld**:
```typescript
// app/api/products/route.ts
const products = await makeBolApiRequest(
  '/retailer/products/list',
  {
    method: 'POST',
    body: JSON.stringify({
      ean: ean || undefined,
      productIds: productIds || undefined,
      title: title || undefined
    })
  },
  true // Use cache
)
```

**Response**:
```json
{
  "products": [
    {
      "productId": "1234567890",
      "ean": "8712626055140",
      "title": "Product naam",
      "rating": 4.5,
      "ratingCount": 100,
      "salesRanking": 1,
      "offerData": {...},
      "mediaUrls": [...]
    }
  ]
}
```

### GET - Specifiek product

**Endpoint**: `GET /retailer/products/{product-id}`

### GET - Competing Offers

**Endpoint**: `GET /retailer/products/{product-id}/offers`

### GET - Product Ratings

**Endpoint**: `GET /retailer/products/{product-id}/ratings`

### GET - Product Ranking

**Endpoint**: `GET /retailer/products/{product-id}/rankings`

### Implementatie Checklist

- [x] Producten zoeken via POST
- [x] Specifiek product ophalen
- [x] Competing offers ophalen
- [x] Product ratings ophalen
- [x] Product ranking ophalen
- [x] Caching implementeren

---

## 📝 Product Content API

### Endpoint: `/retailer/product-content`

**Rate Limit**: 20 requests per minuut

### POST - Product Content Upload

**Endpoint**: `POST /retailer/product-content`

**Body** (multipart/form-data):
```json
{
  "file": File,
  "format": "CSV" | "XML"
}
```

**Proces**:
1. POST naar `/retailer/product-content` → krijg `processStatusId`
2. Poll `/retailer/process-status/{processStatusId}` tot status `SUCCESS`
3. Haal upload report op

**Voorbeeld**:
```typescript
// app/api/product-content/route.ts
const formData = new FormData()
formData.append('file', file)
formData.append('format', 'CSV')

const uploadResponse = await makeBolApiRequest(
  '/retailer/product-content',
  {
    method: 'POST',
    body: formData
  },
  false // Don't cache POST
)

const processStatusId = uploadResponse.processStatusId
```

### GET - Upload Report

**Endpoint**: `GET /retailer/product-content/upload-report/{upload-id}`

### POST - Chunk Recommendations

**Endpoint**: `POST /retailer/product-content/chunk-recommendations`

**Body**:
```json
{
  "ean": "8712626055140",
  "condition": {
    "name": "NEW",
    "category": "NEW"
  }
}
```

**Voorbeeld**:
```typescript
// app/api/product-content/chunk-recommendations/route.ts
const recommendations = await makeBolApiRequest(
  '/retailer/product-content/chunk-recommendations',
  {
    method: 'POST',
    body: JSON.stringify({
      ean: ean,
      condition: { name: condition, category: condition }
    })
  },
  false // Don't cache POST
)
```

### Implementatie Checklist

- [x] Product content uploaden (asynchroon)
- [x] Process status polling
- [x] Upload report ophalen
- [x] Chunk recommendations ophalen

---

## 📈 Performance Indicators API

### Endpoint: `/retailer/insights/performance/indicator`

**Rate Limit**: 20 requests per minuut

### GET - Performance Indicators

**Endpoint**: `GET /retailer/insights/performance/indicator`

**Query Parameters**:
- `name` (string): Indicator naam (`SALES`, `TURNOVER`, `VISITORS`, etc.)
- `period` (string): Periode (`WEEK`, `MONTH`, `YEAR`)
- `number-of-periods` (number): Aantal periodes

**Voorbeeld**:
```typescript
// app/api/performance/route.ts
const performance = await makeBolApiRequest(
  `/retailer/insights/performance/indicator?name=SALES&period=MONTH&number-of-periods=12`,
  {},
  true // Use cache
)
```

**Response**:
```json
{
  "name": "SALES",
  "type": "SALES",
  "total": {
    "value": 1000,
    "unit": "COUNT"
  },
  "periods": [
    {
      "period": "2025-11",
      "value": 100,
      "unit": "COUNT"
    }
  ]
}
```

### Beschikbare Indicators

- `SALES`: Aantal verkopen
- `TURNOVER`: Omzet
- `VISITORS`: Bezoekers
- `CONVERSION`: Conversie percentage
- `REVENUE`: Revenue

### Implementatie Checklist

- [x] Performance indicators ophalen
- [x] Meerdere periodes ophalen
- [x] Caching implementeren (30 minuten TTL)

---

## 🎁 Promotions API

### Endpoint: `/retailer/promotions`

**Rate Limit**: 20 requests per minuut

### GET - Promoties ophalen

**Endpoint**: `GET /retailer/promotions`

**Query Parameters**:
- `promotion-type` (string): Type promotie
- `active` (boolean): Alleen actieve promoties

**Voorbeeld**:
```typescript
const promotions = await makeBolApiRequest(
  `/retailer/promotions?active=true`,
  {},
  true // Use cache
)
```

### POST - Promotie aanmaken

**Endpoint**: `POST /retailer/promotions`

### PUT - Promotie bijwerken

**Endpoint**: `PUT /retailer/promotions/{promotion-id}`

### DELETE - Promotie verwijderen

**Endpoint**: `DELETE /retailer/promotions/{promotion-id}`

### Implementatie Checklist

- [x] Promoties ophalen
- [x] Promotie aanmaken
- [x] Promotie bijwerken
- [x] Promotie verwijderen

---

## 🏪 Retailers API

### Endpoint: `/retailer/retailers`

**Rate Limit**: 20 requests per minuut

### GET - Retailer Informatie

**Endpoint**: `GET /retailer/retailers/me`

**Voorbeeld**:
```typescript
const retailerInfo = await makeBolApiRequest(
  '/retailer/retailers/me',
  {},
  true // Use cache
)
```

**Response**:
```json
{
  "retailerId": "1234567890",
  "displayName": "Retailer Naam",
  "registrationDate": "2025-01-01",
  "status": "ACTIVE"
}
```

### Implementatie Checklist

- [x] Retailer informatie ophalen
- [x] Caching implementeren (1 uur TTL - verandert zelden)

---

## 🏷️ Shipping Labels API

### Endpoint: `/retailer/shipping-labels`

**Rate Limit**: 20 requests per minuut

### POST - Shipping Label Aanmaken

**Endpoint**: `POST /retailer/shipping-labels`

**Body**:
```json
{
  "orderItems": [
    {
      "orderItemId": "1234567890"
    }
  ],
  "shippingLabelOfferId": "3-TNT"
}
```

**Voorbeeld**:
```typescript
const shippingLabel = await makeBolApiRequest(
  '/retailer/shipping-labels',
  {
    method: 'POST',
    body: JSON.stringify({
      orderItems: [{ orderItemId: orderItemId }],
      shippingLabelOfferId: shippingLabelOfferId
    })
  },
  false // Don't cache POST
)
```

### GET - Shipping Label Ophalen

**Endpoint**: `GET /retailer/shipping-labels/{shipping-label-id}`

### Implementatie Checklist

- [x] Shipping label aanmaken
- [x] Shipping label ophalen

---

## 🔔 Subscriptions API

### Endpoint: `/retailer/subscriptions`

**Rate Limit**: 20 requests per minuut

### GET - Subscriptions Lijst

**Endpoint**: `GET /retailer/subscriptions`

**Voorbeeld**:
```typescript
const subscriptions = await makeBolApiRequest(
  '/retailer/subscriptions',
  {},
  true // Use cache
)
```

### POST - Subscription Aanmaken

**Endpoint**: `POST /retailer/subscriptions`

**Body**:
```json
{
  "resources": ["ORDERS", "SHIPMENTS"],
  "url": "https://your-webhook-url.com/webhook"
}
```

### PUT - Subscription Bijwerken

**Endpoint**: `PUT /retailer/subscriptions/{subscription-id}`

### DELETE - Subscription Verwijderen

**Endpoint**: `DELETE /retailer/subscriptions/{subscription-id}`

### Implementatie Checklist

- [x] Subscriptions ophalen
- [x] Subscription aanmaken
- [x] Subscription bijwerken
- [x] Subscription verwijderen

---

## ⏳ Process Status API

### Endpoint: `/retailer/process-status`

**Rate Limit**: 50 requests per minuut

### GET - Process Status Ophalen

**Endpoint**: `GET /retailer/process-status/{process-status-id}`

**Voorbeeld**:
```typescript
// lib/api.ts
export async function getProcessStatus(processStatusId: string) {
  return makeBolApiRequest(`/retailer/process-status/${processStatusId}`)
}
```

**Response**:
```json
{
  "processStatusId": "1234567890",
  "entityId": "9876543210",
  "eventType": "CREATE_OFFER_EXPORT",
  "description": "Export wordt verwerkt...",
  "status": "PENDING" | "SUCCESS" | "FAILURE",
  "errorMessage": null,
  "createTimestamp": "2025-11-23T10:00:00Z"
}
```

### Status Waarden

- `PENDING`: Proces loopt nog
- `SUCCESS`: Proces succesvol afgerond
- `FAILURE`: Proces mislukt

### Polling Strategie

```typescript
async function pollProcessStatus(processStatusId: string, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getProcessStatus(processStatusId)
    
    if (status.status === 'SUCCESS') {
      return status
    }
    
    if (status.status === 'FAILURE') {
      throw new Error(status.errorMessage || 'Process failed')
    }
    
    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  
  throw new Error('Process timeout')
}
```

### Implementatie Checklist

- [x] Process status ophalen
- [x] Polling implementatie
- [x] Error handling

---

## ⚡ Rate Limits Overzicht

### Kritieke Endpoints (Wees Voorzichtig!)

| Endpoint | Methode | Rate Limit | Tijd Venster |
|----------|---------|------------|--------------|
| `/retailer/offers/export` | POST | **9 requests** | **1 uur** ⚠️ |
| `/retailer/offers/export/*` | GET | **9 requests** | **1 uur** ⚠️ |
| `/retailer/offers` | GET | 25 requests | 1 seconde |
| `/retailer/offers` | POST | 50 requests | 1 seconde |
| `/retailer/orders` | GET | 25 requests | 1 minuut |
| `/retailer/orders/*` | GET | 25 requests | 1 seconde |
| `/retailer/shipments` | POST | 25 requests | 1 seconde |
| `/retailer/returns` | GET/POST | 20 requests | 1 minuut |
| `/retailer/invoices` | GET | 24 requests | 1 minuut |
| `/retailer/commissions` | POST | 28 requests | 1 seconde |
| `/retailer/inventory` | GET | 20 requests | 1 minuut |
| `/retailer/products/list` | POST | 50 requests | 1 minuut |
| `/retailer/product-content` | POST | 20 requests | 1 minuut |
| `/retailer/insights/performance/indicator` | GET | 20 requests | 1 minuut |

### Rate Limit Headers

Elke API response bevat:
```http
X-RateLimit-Limit: 25
X-RateLimit-Remaining: 24
X-RateLimit-Reset: 1637676000
```

### Rate Limit Error Handling

```typescript
// lib/api.ts
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After') || 60
  throw new RateLimitError(
    `Rate limit bereikt. Probeer opnieuw over ${retryAfter} seconden.`,
    parseInt(retryAfter),
    429
  )
}
```

---

## 🎯 Best Practices

### 1. Token Management

- ✅ **Cache tokens** (1 uur geldig, refresh 5 minuten voor expiry)
- ✅ **Automatische refresh** bij 401 errors
- ✅ **Clear cache** bij authenticatie errors

### 2. Caching Strategie

- ✅ **Cache GET requests** met endpoint-specifieke TTL
- ✅ **Gebruik change-interval-minute** voor orders (alleen nieuwe/gewijzigde orders)
- ✅ **Persistent cache** voor kritieke data
- ✅ **Cache invalidation** bij POST/PUT/DELETE

### 3. Rate Limit Management

- ✅ **Monitor rate limit headers** in responses
- ✅ **Implementeer exponential backoff** bij rate limit errors
- ✅ **Gebruik caching** om API calls te minimaliseren
- ✅ **Vermijd offers export** op dashboard (9 requests/uur!)

### 4. Error Handling

- ✅ **401 errors**: Clear token cache en retry
- ✅ **429 errors**: Respecteer Retry-After header
- ✅ **500 errors**: Implementeer retry met backoff
- ✅ **Network errors**: Implementeer retry logic

### 5. Asynchrone Processen

- ✅ **Poll process status** voor exports en uploads
- ✅ **Implementeer timeout** voor lange processen
- ✅ **Gebruik webhooks** (subscriptions) waar mogelijk

### 6. Data Optimalisatie

- ✅ **Gebruik paginering** voor grote datasets
- ✅ **Filter data** op server-side waar mogelijk
- ✅ **Gebruik change-interval-minute** voor incrementele updates
- ✅ **Combineer requests** waar mogelijk (dashboard endpoint)

### 7. Security

- ✅ **Store credentials** in environment variables
- ✅ **Never expose** API keys in client-side code
- ✅ **Use HTTPS** voor alle API calls
- ✅ **Validate input** voor alle user inputs

---

## 📚 Referenties

- **BOL API Documentatie**: https://api.bol.com/retailer/public/Retailer-API/index.html
- **Rate Limits**: https://api.bol.com/retailer/public/ratelimits
- **Redoc API Reference**: https://api.bol.com/retailer/public/redoc/v10/retailer.html
- **Postman Collection**: https://documenter.getpostman.com/view/19794538/2s9YBxZwUC

---

## 🔄 Changelog

- **2025-11-23**: Eerste versie - Complete API overzicht met setup instructies
- **2025-11-23**: Rate limits toegevoegd
- **2025-11-23**: Best practices sectie toegevoegd

---

**Laatste update**: 2025-11-23  
**Versie**: 1.0.0  
**Auteur**: BOL API Expert



# Bol.com Retailer API - Beschikbare Data Overzicht

## 📦 Orders API

### GET /retailer/orders
**Beschikbare data:**
- `orderId` - Unieke order identificatie
- `orderPlacedDateTime` - Datum en tijd van plaatsing
- `orderItems[]` - Array van order items met:
  - `orderItemId` - Unieke item identificatie
  - `ean` - European Article Number
  - `quantity` - Aantal
  - `offerReference` - Referentie naar je eigen systeem
  - `fulfilment.method` - FBR (Fulfilment by Retailer) of FBB (Fulfilment by bol)
  - `unitPrice` - Prijs per stuk
  - `commission` - Commissie
  - `latestChangedDateTime` - Laatste wijziging
  - `cancellationRequest` - Annuleringsverzoek info

**Filters:**
- `fulfilment-method`: FBR, FBB, ALL
- `status`: OPEN, ALL, SHIPPED
- `change-interval-minute`: Alleen nieuwe/gewijzigde orders

### GET /retailer/orders/{order-id}
**Volledige order details:**
- Alle bovenstaande data PLUS:
- `customerDetails`:
  - `salutationCode` - Aanspreekvorm
  - `firstName` - Voornaam
  - `surname` - Achternaam
  - `streetName` - Straatnaam
  - `houseNumber` - Huisnummer
  - `houseNumberExtension` - Toevoeging
  - `zipCode` - Postcode
  - `city` - Plaats
  - `countryCode` - Landcode
  - `email` - Emailadres
  - `deliveryPhoneNumber` - Telefoonnummer
- `billingDetails` - Factuuradres (zelfde structuur als customerDetails)
- `shipmentDetails`:
  - `shipmentId` - Verzending ID
  - `shipmentDateTime` - Verzenddatum
  - `transporterCode` - Vervoerder code
  - `trackAndTrace` - Track & trace nummer
- `expiryDate` - Vervaldatum van order

## 🛍️ Offers API

### GET /retailer/offers/{offer-id}
**Beschikbare data:**
- `offerId` - Unieke offer identificatie
- `ean` - European Article Number
- `condition` - Conditie (nieuw, gebruikt, etc.)
- `pricing`:
  - `bundlePrices[]` - Volume kortingen
    - `quantity` - Minimum aantal
    - `price` - Prijs voor die hoeveelheid
- `stock`:
  - `amount` - Huidige voorraad
  - `correctedStock` - Gecorrigeerde voorraad (minus open orders)
  - `managedByRetailer` - Of voorraad door retailer beheerd wordt
- `fulfilment.method` - FBR of FBB
- `onHoldByRetailer` - Of offer op hold staat
- `unknownProductTitle` - Tijdelijke titel voor onbekende producten
- `reference` - Je eigen referentie
- `deliveryCode` - Levertijd code
- `economicOperatorId` - EU economische operator ID

### POST /retailer/offers/export
**Export file met alle offers:**
- CSV bestand met alle offers
- Bevat: EAN, Offer ID, en alle offer data
- Asynchroon proces (gebruik process status)

## 📊 Andere Beschikbare Data

### Products API
- Product informatie
- Product ratings
- Product rankings
- Competing offers
- Price star boundaries

### Returns API
- Retour informatie
- Retour redenen
- Retour status

### Shipments API
- Verzendingen lijst
- Verzending details
- Transport informatie
- Invoice requests

### Commissions API
- Commissie informatie
- Commissie berekeningen

### Invoices API
- Factuur informatie
- Factuur upload

### Performance Indicators
- Verkoop statistieken
- Performance metrics

## 🔐 Authenticatie

Alle API calls gebruiken OAuth 2.0:
- Client ID (API_KEY)
- Client Secret (API_SECRET)
- Access token via `/token` endpoint

## ⚠️ Rate Limiting

- API heeft rate limits
- 429 errors met retry-after tijd
- Gebruik change-interval-minute om alleen nieuwe data op te halen

## 📝 Best Practices

1. **Polling**: Poll elke 5-15 minuten voor nieuwe orders
2. **Change Interval**: Gebruik `change-interval-minute` parameter
3. **Caching**: Cache data lokaal om rate limits te voorkomen
4. **Error Handling**: Implementeer retry logic voor rate limits
5. **Async Processes**: Offers export is asynchroon - check process status


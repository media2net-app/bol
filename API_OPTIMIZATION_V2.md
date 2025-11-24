# API Optimalisatie - Single Call Strategie

## Overzicht

Het dashboard gebruikt nu een **single call strategie** om alle data op te halen binnen de rate limits van bol.com.

## Strategie

### Dashboard Endpoint (`/api/dashboard`)

**Maximaal 1 API call per dashboard refresh:**

1. **Cache Check Eerst**
   - Controleert eerst of er cached orders data beschikbaar is
   - Als cached data beschikbaar is: **0 API calls** ✅
   - Als geen cache: **1 API call** voor orders

2. **Change-Interval Optimalisatie**
   - Gebruikt `change-interval-minute=60` (laatste uur)
   - Haalt alleen nieuwe/gewijzigde orders op
   - Minimaliseert data transfer

3. **Offers Export - Altijd Geskipt**
   - Offers export is zeer duur (9 requests per uur!)
   - Wordt volledig overgeslagen op dashboard
   - Gebruik de Offers pagina voor offers data

4. **Revenue - Eigen Caching**
   - Revenue gebruikt eigen endpoint met caching
   - Gebruikt cached orders data waar mogelijk
   - Minimale API calls

## Rate Limits

**Orders API:**
- **25 requests per minuut**
- Met caching: **0-1 call per dashboard refresh**
- Met 60 minuten change-interval: **max 1 call per uur**

**Offers Export:**
- **9 requests per uur** (zeer beperkt!)
- Wordt niet gebruikt op dashboard

## Resultaat

**Voor optimalisatie:**
- Dashboard: 2-3 API calls (orders, allOrders, offers export)
- Revenue: 1 API call
- **Totaal: 3-4 calls per refresh**

**Na optimalisatie:**
- Dashboard: 0-1 API call (afhankelijk van cache)
- Revenue: 0-1 API call (afhankelijk van cache)
- **Totaal: 0-2 calls per refresh** ✅

## Cache TTL

- **Orders:** 48 seconden (80% van 1 minuut rate limit window)
- **Revenue:** 30 minuten (verandert niet zo vaak)
- **Persistent cache:** Blijft beschikbaar na server restart

## Gebruik

Het dashboard gebruikt automatisch:
1. Cached data als beschikbaar
2. 1 API call alleen als nodig
3. Rate limit info wordt getoond
4. API call summary in dashboard

**Resultaat:** Geen rate limit errors meer! 🎉



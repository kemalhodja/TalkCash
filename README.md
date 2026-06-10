# TalkCash

Blockchain tabanlı sosyal ödeme platformu. Konuşarak para gönder, mesajlaşırken ödeme yap.

## Proje Yapısı

```
talkcash/
├── index.html      # Ana sayfa (landing page)
├── sale.html       # TALK token ön satış sayfası
├── css/
│   └── style.css   # Ortak stiller
├── js/
│   └── wallet.js   # MetaMask / Web3 entegrasyonu
└── README.md
```

## Özellikler

- Modern, responsive landing page
- BSC üzerinde TALK token ön satışı
- MetaMask cüzdan entegrasyonu
- Tokenomics ve yol haritası

## Kurulum

Statik bir web sitesidir, ek kurulum gerekmez. Dosyaları bir web sunucusunda barındırın veya doğrudan tarayıcıda açın:

```bash
# Basit yerel sunucu
python3 -m http.server 8080
```

Ardından `http://localhost:8080` adresine gidin.

## Token Bilgileri

| Özellik        | Değer              |
|----------------|--------------------|
| Token Adı      | TalkCash (TALK)    |
| Standard       | BEP-20             |
| Ağ             | Binance Smart Chain|
| Toplam Arz     | 10.000.000         |
| Ön Satış Oranı | 1 BNB = 10.000 TALK|

## Akıllı Sözleşme

Ön satış sözleşme adresi `js/wallet.js` dosyasındaki `SALE_CONTRACT` değişkeninde tanımlanır. Mainnet lansmanından önce gerçek adres ile güncellenmelidir.

## Lisans

TalkCash © 2025

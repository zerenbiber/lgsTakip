# Sadeleştirme — v2 arayüz planı

Hedef kullanıcı: 8. sınıf öğrencisi (13–14 yaş). Uygulama bir **ajanda/program defteri** gibi hissettirmeli. Veli ikinci planda. Mevcut `index.html` yeniden düzenlenecek; **veri modeli, localStorage anahtarı (`lgsTakip.v1`), yedek biçimi, LGS verisi, hesaplama fonksiyonları, AI istemcisi, PWA dosyaları korunur.** Mevcut kullanıcı verisi (kitaplar, 19 haftalık program) kaybolmadan yeni arayüzde görünmeli.

## 1. Gezinme
- Sadece 3 ana bölüm + ayarlar:
  1. **📅 Programım** (ana sayfa, `#program`, varsayılan açılış)
  2. **📚 Kitaplarım** (`#kitaplar`)
  3. **📊 LGS** (`#lgs`)
  - ⚙ simgesi (üst sağ) → **Ayarlar** (`#ayarlar`).
- Telefon/tablet dikey: altta sabit 3 düğmeli bar (simge + kısa yazı, her biri ≥56px yükseklik, eşit genişlik, kaydırma yok). ≥900px: üstte aynı 3 düğme.
- Ders başına ayrı sekmeler ve ayrı "Genel Durum" sekmesi **kaldırılır**. Eski hash'ler (`#genel`, `#ders/...`, `#analiz`) yeni karşılıklarına yönlenir (genel→program, ders/x→kitaplar + o ders seçili, analiz→lgs).

## 2. Görsel dil
- Taban yazı 17px, başlıklar 20–24px, yuvarlak köşeler (14–18px), bol boşluk, yumuşak renkler; açık tema varsayılan, koyu tema desteklenir.
- Her derse sabit renk + emoji: Türkçe 📖, Matematik ➗, Fen 🔬, İnkılap 🇹🇷, Din 🕌, İngilizce 🇬🇧, özel dersler 📘. (Emoji `subject.emoji` alanında; yoksa bu varsayılanlar.)
- Uzun ders adları için kısa ad: `shortName` (Türkçe, Matematik, Fen, İnkılap, Din, İngilizce). Çiplerde ve kartlarda kısa ad kullanılır.
- Teknik terim yok ("oturum" yerine "ders/görev", "JSON" sadece Ayarlar'da, "bütçe" yok).
- Başarı anında küçük kutlama: görev işaretlenince kart yeşile döner + "Aferin! 🎉" tostu (gün bitince "Bugünkü programı bitirdin! 🌟").

## 3. 📅 Programım (ana sayfa)
Yukarıdan aşağı:
1. **Üst şerit:** "Merhaba 👋" + küçük rozet "LGS'ye 207 gün". Altında bu haftanın ilerleme çubuğu: "Bu hafta 12 / 30 görev ✔".
2. **Hafta seçici:** `‹` `23–29 Kasım` `›` (ortadaki yazıya dokununca "Bu haftaya dön").
3. **Gün şeridi:** 7 gün yatay hap (Pzt 23, Sal 24 …). Bugün vurgulu; her hapın altında küçük nokta/sayaç (o günün biten/toplam). Dokununca o gün seçilir. Açılışta bugün seçili (bu hafta değilse Pazartesi). Telefonda kaydırılabilir, tablette 7'si sığar.
4. **Seçili günün sayfası** (defter sayfası görünümü):
   - Başlık: "Pazartesi, 23 Kasım". Altında **gün notu** satırı (ör. "Dershane günü"); dokununca düzenlenir, boşsa soluk "+ Not ekle".
   - Görev kartları listesi (sıra: `start` varsa saate göre, sonra eklenme sırası). Kart: solda ders rengi şerit + emoji, büyük yazıyla başlık (`title`), altında küçük satır "Kısa ders adı · Kitap adı · 40 dk" (olanlar). Sağda büyük (≥44px) yuvarlak onay kutusu. Kartın kendisine dokununca **Görev düzenle** penceresi.
   - Liste boşsa: dostça boş durum "Bugün için görev yok. ➕ Görev ekle".
   - Altta tam genişlik büyük **"➕ Görev ekle"** düğmesi.
   - Kartlarda yukarı/aşağı taşıma: düzenleme penceresinde "⬆ Yukarı / ⬇ Aşağı" düğmeleri (sürükle-bırak yok). Sıra `order` alanıyla tutulur (yoksa mevcut sıradan türetilir); saat girilmişse yine saate göre sıralanır, saat yoksa `order`.
5. **Hafta menüsü** (gün sayfasının üstünde tek "⋯ Hafta işlemleri" düğmesi, açılır liste): Geçen haftayı kopyala · Bu günü başka güne kopyala · Haftayı temizle · Program yükle (dosya / yapıştır, çok haftalık JSON dahil — mevcut pasteModal) · Otomatik program öner · AI ile program öner (anahtar varsa) · Yazdır.

### Görev ekle/düzenle penceresi (alt sayfa / bottom sheet görünümü, telefonda tam genişlik)
- **Ders:** yatay kaydırılabilir renkli çipler (emoji + kısa ad), bir tane seçilir; ek çip "🧪 Deneme" (subjectId `''`).
- **Kitap (opsiyonel):** seçili dersin kitapları çip olarak ("Kitapsız" + kitaplar). Kitabın bölümleri/konuları varsa ikinci çip satırı: hangi bölüm. Seçilen bölüm görev tamamlanınca o bölüme +1 ilerleme ekler mi? → **Hayır**, otomatik değil; sadece bağlantı. (Basitlik ve beklenmedik değişiklik olmasın.)
- **Ne yapacaksın?** tek satır metin (zorunlu değil; boşsa kitap/bölüm/ders adından üretilir). Örnek ipucu: "Olasılık — 2 test".
- **Süre:** çipler 20 · 30 · 40 · 60 · 90 dk (varsayılan 40). **Saat (opsiyonel):** saat seçici, boş bırakılabilir.
- **Gün:** 7 gün çipi (düzenlerken görevi başka güne taşımak için).
- Düğmeler: **Kaydet** (büyük), Vazgeç; düzenlemede ayrıca 🗑 Sil (onaylı), ⬆ ⬇.

### Veri
- Mevcut `state.plans[weekStart].sessions[]` kullanılır. Yeni alanlar: `session.order` (number, opsiyonel), `plan.dayNotes` (7 elemanlı string dizisi).
- Göç (migrateState): `dayNotes` yoksa `plan.note` içinden "Gün: metin" parçaları (`·` ile ayrılmış, gün adları Pazartesi…Pazar) ayrıştırılıp ilgili güne yazılır; ayrıştırılamayan kalan metin `plan.note`'ta kalır. `start` alanı boş string olabilir (saatsiz görev). PDF'den gelen 18:00/18:40… sahte saatler: göçte **source === 'import' olan planlarda** saatleri koru (kullanıcı silebilir) — ama kartta saat yalnızca doluysa gösterilir.
- Haftalık ilerleme: biten / toplam görev sayısı (dakika değil).

## 4. 📚 Kitaplarım
1. **"➕ Kitap ekle" kartı** (en üstte, her zaman görünür, sade):
   - "Hangi ders?" → yatay kaydırılabilir büyük ders çipleri (emoji + kısa ad, ≥48px). Seçilen çip dolu renkli olur.
   - "Kitabın adı" metin kutusu (ör. "Altın Kural Soru Bankası").
   - "Kaç test / bölüm var?" sayı kutusu (opsiyonel, varsayılan boş). 
   - "Konuları da yazmak ister misin?" bağlantısı → açılınca çok satırlı alan, her satıra bir konu (mevcut toplu yapıştır ayrıştırıcısı kullanılabilir: `Konu | 12 | test`). Konu girilirse kitap bölümleri konulardan oluşur; girilmezse ve sayı girildiyse tek bölüm "Testler" (total = sayı, unit test); hiçbiri yoksa tek bölüm "Kitap" (total 1).
   - **"Kitabı ekle"** düğmesi → kitap o derse atanır, tost "📚 Kitap Matematik dersine eklendi", form temizlenir (ders seçimi kalır), aşağıdaki liste o derse geçer.
2. **Ders seçici:** aynı yatay çip şeridi (ilk çip "Hepsi"). Seçili ders `ui.bookSubject` (localStorage'da hatırlanır).
3. **Seçili dersin özeti:** pasta grafik (biten / kalan, mevcut `subjectProgress` hesabı; "Hepsi" seçiliyse tüm dersler) + ortada büyük yüzde + "3 kitap · 45/120 test".
4. **Kitap kartları:** kitap adı, ders emojisi, ilerleme çubuğu + yüzde. Karta dokununca **kitap sayfası** (pencere): bölümler listesi; her bölümde büyük `−` `sayaç/toplam` `+` veya tek birimlikse onay kutusu; altta "Kitabı düzenle" (ad, ders değiştir, bölüm ekle/sil) ve "Kitabı sil".
5. "Hepsi" görünümünde kitaplar ders başlıkları altında gruplanır.
- Ders ekle/gizle (özel ders) Ayarlar'a taşınır.

## 5. 📊 LGS
- Üstte kısa genel durum (eski Genel Durum'dan): geri sayım, toplam ilerleme yüzdesi, en zayıf 3 ders.
- Altında mevcut LGS Analiz içeriği (ders çipleri ile filtre, konu tablosu, soru sayıları, öncelikli konular, grafik, veri bilgisi ve "Veriyi güncelle"). İçerik mantığı aynı, sadece ders seçimi çip şeridine dönüşür ve yazılar büyür. Veri kaynağı/uyarı metinleri bir "ℹ Veri hakkında" açılır bölümüne alınır.

## 6. ⚙ Ayarlar
Mevcut ayarlar aynen (sınav tarihi, günlük süreler — "Otomatik öneri için günlük çalışma süren" olarak, API anahtarı, web araması, tema, yedek al/yükle, veri güncelle, telefona yükle yardımı) + taşınan "Dersleri yönet" (özel ders ekle, gizle/göster, emoji seç).

## 7. Korunacaklar / kabul listesi
- [ ] Var olan kitaplar ve 19 haftalık program yeni arayüzde görünür; hiçbir veri silinmez. Yedek dışa/içe aktarım aynen çalışır.
- [ ] Açılışta Programım; bugün seçili; görev ekle → kaydet → kart görünür; işaretle → kutlama; düzenle → başka güne taşı; sil.
- [ ] Gün notu düzenlenir ve kaydedilir; PDF'den gelen "Salı: Dershane günü" vb. göçte günlere dağılmış görünür.
- [ ] Kitap ekle: ders çipi seç → ad yaz → ekle → kitap o derste, pasta güncellenir.
- [ ] Görev penceresinde ders seçince o dersin kitapları çıkar.
- [ ] 375px ve 800px (tablet) genişlikte yatay kaydırma yok (çip şeritleri kendi içinde kaydırılır); tüm dokunma hedefleri ≥44px.
- [ ] Konsolda hata yok; file:// ve http'de çalışır; AI anahtarsız uygulama tam çalışır.
- [ ] Kullanıcı metni hiçbir yerde innerHTML ile basılmaz (mevcut `el()`/textContent yaklaşımı korunur).
- [ ] sw.js `CACHE` sürümü artırılır.

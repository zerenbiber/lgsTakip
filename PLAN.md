# LGS Çalışma Takip Uygulaması — Uygulama Planı

Hedef: 8. sınıf öğrencisi ve ailesi için, tek dosyalık (`index.html`) bir çalışma takip uygulaması. Kitap/konu takibi, ders bazlı ilerleme, LGS konu-ağırlık analizi, haftalık program (manuel + kural tabanlı + yapay zekâ), veli özeti.
Bu plan tek kaynak (spec) dır; kodu yazan ajan yalnızca bunu ve `lgs-data.json`'u kullanır. Belirsiz bir noktada **en basit** yorumu seç ve koda `// NOTE:` yorumu düş.

---

## 1. Dosya yapısı ve teknik kısıtlar

```
index.html        ← tek, kendi kendine yeterli uygulama (HTML + <style> + <script>)
lgs-data.json     ← araştırılmış LGS verisi (kaynak gerçek). index.html içine AYNEN gömülür.
PLAN.md           ← bu dosya
```

- Vanilla JS (ES2020), framework yok, build adımı yok. `file://` ile açıldığında tam çalışmalı.
- Tek dış bağımlılık: Chart.js **4.4.1** — `<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>` (SRI ekleme). Grafik oluşturma her zaman `if (window.Chart)` kontrolüyle; Chart yoksa (çevrimdışı) **CSS yedeği**: pasta için `conic-gradient` daire + yüzde etiketi, çubuk için yatay `div` barları. Uygulama Chart.js olmadan da kullanılabilir olmalı.
- Gömülü veri: `<script id="lgs-data-embedded" type="application/json"> …lgs-data.json içeriği… </script>`; okuma `JSON.parse(document.getElementById('lgs-data-embedded').textContent)`. (İçerikte `</script>` yok; olduğu varsayılmaz.)
- Kalıcılık: `localStorage`, anahtar `lgsTakip.v1` (tüm uygulama durumu tek JSON). Her okuma/yazma `try/catch`; localStorage yoksa bellekte çalış ve üstte uyarı şeridi göster: "Tarayıcı kaydetmeye izin vermiyor; yedeği dışa aktarmayı unutma."
- Kaydetme: her durum değişikliğinde `saveState()` (300 ms debounce).
- Dil: tüm arayüz Türkçe. Tarih biçimi `Intl.DateTimeFormat('tr-TR')`. Büyük/küçük harf dönüşümü ve arama `toLocaleLowerCase('tr-TR')` ile (İ/ı doğru çalışsın). Sıralama `localeCompare(b,'tr')`.
- **Tarih tuzağı:** yerel tarih anahtarları (`YYYY-MM-DD`) `toISOString()` ile ÜRETİLMEZ (UTC kayması). `localDateKey(d)` yardımcı fonksiyonu yaz: `d.getFullYear()`, `getMonth()+1`, `getDate()` ile sıfır dolgulu. Hafta Pazartesi başlar (`weekStartKey(date)`).
- ID üretimi: `crypto.randomUUID?.() ?? Date.now().toString(36)+Math.random().toString(36).slice(2,8)`.
- Güvenlik: kullanıcı/AI/URL kaynaklı tüm metinler DOM'a `textContent` ile veya `escapeHtml()` sonrası yazılır. `innerHTML` yalnızca sabit şablonlar + kaçışlı değerlerle.

## 2. Veri modeli

### 2.1 LGS verisi (`lgs-data.json`, şema v1)
Dosyaya bak; kısaca:
```js
LgsData = {
  schemaVersion: 1, lastUpdated: "YYYY-MM-DD", dataSource: "embedded", disclaimer: string,
  exam: {
    nextExam: { name, date: "2027-06-13", dayOfWeek, format, status, note },
    sessions: [{ id, name, questionCount, durationMin, subjects: [subjectId] }],
    scoring: { totalQuestions, wrongPenalty, coefficients: { [subjectId]: number }, maxScore },
    pastExams: [{ year, scope: "full"|"firstSemesterOnly", date?, note }]
  },
  curriculumNote: string,
  years: [2021..2026], analysisYearsDefault: [2022..2026],
  subjects: [{
    id, name, shortName, color, questionCount, coefficient, session,
    averageCorrect: { "2021": 9.41, ... }, confidence: "high"|"medium"|"low", note,
    topics: [{ id, name, semester: 0|1|2, counts: { "2021": 3, ... }, estimatedYears: [2025, 2026] }]
  }],
  sources: [{ title, url, usedFor }]
}
```
`semester`: 1 = 1. dönem, 2 = 2. dönem, 0 = yıl boyu/beceri (Türkçe).

**Doğrulama `validateLgsData(obj)`** → `{ ok, errors[] }`:
- `schemaVersion === 1`, `subjects` dizi ve boş değil, `years` sayı dizisi.
- Her subject: `id,name,questionCount(number),topics(dizi)`; her topic: `id,name,counts(object)`.
- Uyarı (hata değil): bir yılın konu toplamı `questionCount`'a eşit değilse `warnings[]`'e ekle, önizlemede göster.
- Eksik opsiyonel alanlar varsayılanla doldurulur (`color` → gri, `coefficient` → 1, `estimatedYears` → []).

### 2.2 Uygulama durumu (`localStorage['lgsTakip.v1']`)
```js
AppState = {
  version: 1,
  profile: {
    studentName: "",                 // opsiyonel, başlıkta "Merhaba, X!"
    examDate: null,                  // null → lgsData.exam.nextExam.date kullan
    dailyMinutes: { 0:120,1:120,2:120,3:120,4:120,5:240,6:180 }, // 0=Pzt … 6=Paz
    theme: "auto"                    // "auto" | "light" | "dark"
  },
  settings: {
    apiKey: "",                      // Anthropic API anahtarı (yalnız bu tarayıcıda)
    model: "claude-sonnet-5-5",
    dataUrl: "",                     // "Veriyi güncelle" için JSON URL
    analysisYears: null              // null → lgsData.analysisYearsDefault
  },
  subjects: [{                       // sekmeler bunlardan üretilir
    id,                              // LGS dersleri için lgsData subject id ("matematik"); özel ders için uuid
    name, color,
    lgsSubjectId: "matematik" | null,// LGS dersine bağlı mı
    visible: true, order: 0
  }],
  books: [{
    id, subjectId, title, publisher: "", kind: "konu"|"soru"|"deneme"|"karma",
    createdAt: ISOString, archived: false,
    items: [{                        // kitap içi bölüm/konu/test
      id, title,
      lgsTopicId: "mat-uslu-ifadeler" | null,
      unit: "test" | "sayfa" | "konu",// sayaç birimi
      total: 1,                      // ≥1; "konu" için genelde 1 (checkbox)
      done: 0,                       // 0..total
      completedAt: null | ISOString
    }]
  }],
  topicOverrides: { [lgsTopicId]: "done" | "inProgress" | "notStarted" }, // elle işaretleme (okulda bitti vb.)
  activity: [{ ts: ISOString, date: "YYYY-MM-DD", bookId, itemId, delta: number }], // ilerleme günlüğü
  plans: {                           // haftalık programlar, anahtar = haftanın Pazartesi'si
    "2026-11-16": {
      weekStart: "2026-11-16", source: "manual"|"rule"|"ai"|"import",
      createdAt, note: "",
      sessions: [{
        id, day: 0..6, start: "17:00" | "", durationMin: 40,
        subjectId, lgsTopicId: null, bookId: null, itemId: null,
        title: "Üslü İfadeler — 2 test", done: false
      }]
    }
  },
  lgsDataOverride: null | LgsData,   // güncellenmiş veri; null → gömülü
  lgsDataMeta: { source: "embedded"|"url"|"ai"|"file", appliedAt: ISOString|null, previous: LgsData|null } // "geri al" için 1 önceki
}
```
- **İlk açılış (state yok):** `subjects` = lgsData'daki 6 ders (`id`=lgs id, `lgsSubjectId`=aynı id, `color` veriden). `books=[]`, `plans={}`.
- **Migrasyon:** `state.version` yoksa/eskiyse `migrateState()`; bilinmeyen alanları koru.
- Aktif LGS verisi: `getLgsData() = state.lgsDataOverride ?? embedded`.
- Ders silinirse kitapları da silinir (onay diyaloğu ile). LGS dersi silinmez, yalnız `visible=false` yapılabilir.

### 2.3 Hesaplamalar (saf fonksiyonlar, tek yerde)
- `itemFraction(it) = clamp(it.done / it.total, 0, 1)`; `it.done === it.total` ⇒ "tamam".
- `bookProgress(book)` = item kesirlerinin **ortalaması** (her bölüm eşit ağırlık; sayfa sayısı kitapları domine etmesin). Ayrıca `{doneItems, totalItems}` döndür.
- `subjectProgress(subjectId)` = arşivlenmemiş tüm kitapların tüm item'larının kesir **toplamı / item sayısı**. Pasta: `tamamlanan = Σ kesir`, `kalan = itemSayısı − Σ kesir` (ondalık olabilir; etikette yüzde göster).
- `topicStatus(lgsTopicId)`:
  1. `topicOverrides[id]` varsa o.
  2. Bağlı item yoksa `"notStarted"` (+ bayrak `noMaterial: true` → "Kitaplarında bu konu yok").
  3. Bağlı tüm item'lar tamam → `"done"`; herhangi birinde `done>0` → `"inProgress"`; aksi `"notStarted"`.
  `topicCompletion(id)` = bağlı item kesirlerinin ortalaması (override done → 1, notStarted → 0).
- `topicWeight(topic, years)` = seçili yıllarda, **konunun kapsamda olduğu yılların** ortalaması: `pastExams[y].scope==="firstSemesterOnly" && topic.semester===2` olan yıllar hesaptan çıkarılır (2023'te 2. dönem konuları sorulmadı; 0 değil "kapsam dışı"). Sonuç: `avgQuestions` (1 ondalık).
- `isHighWeight(topic, subject)` = `avgQuestions / subject.questionCount >= 0.15` **veya** konu, dersindeki `avgQuestions` sıralamasında ilk 3'te ve `avgQuestions >= 1.5`.
- `priorityScore(topic, subject)` = `avgQuestions × subject.coefficient × (1 − topicCompletion)`. Program önerisi ve "öncelikli konular" bu skora göre sıralar.
- `daysToExam()` = bugünden `examDate`'e kalan tam gün (yerel tarih). Geçmişse negatif → "Sınav tarihi geçti — Ayarlar'dan yeni tarihi gir."
- `weekCompletion(weekStart)` = o haftanın plan oturumlarında `done` dakika / toplam dakika; plan yoksa `null`.
- `weekActivity(weekStart)` = `activity` içinde o haftaya düşen pozitif `delta` toplamı (çözülen test/sayfa/konu sayısı).
- `subjectEstimatedNet` YOK (deneme takibi kapsam dışı).

## 3. Genel düzen ve tasarım

- Üstte başlık şeridi: uygulama adı "LGS Yolculuğum", sağda **geri sayım rozeti** ("LGS'ye 207 gün") ve ⚙ Ayarlar düğmesi.
- Altında **sekme çubuğu** (yatay kaydırılabilir, telefonda `overflow-x:auto`, aktif sekme görünür alana kaydırılır):
  `Genel Durum` · `[ders sekmeleri: visible, order sırasıyla, ders renginde nokta]` · `+ Ders` · `LGS Analiz` · `Haftalık Program`
  Ayarlar ayrı bir sekme/görünüm (`#ayarlar`).
- Yönlendirme: `location.hash` (`#genel`, `#ders/matematik`, `#analiz`, `#program`, `#ayarlar`); geri/ileri çalışır; son sekme hatırlanır.
- Tasarım: temiz, sade, çocuk dostu (yuvarlatılmış kartlar `border-radius:14px`, yumuşak gölgeler, ders renkleri, küçük emoji yok — yalnızca basit ikonlar için Unicode/inline SVG), sistem yazı tipi yığını. Renkler `:root` CSS değişkenleri; `@media (prefers-color-scheme: dark)` + `:root[data-theme="dark"]` / `[data-theme="light"]` ile tema. `body` arka planı açıkça tanımlı.
- Responsive: 16px yan boşluk, yatay sayfa kaydırması yok; ≥900px'te kartlar 2-3 sütun grid, altında tek sütun. Dokunma hedefleri ≥40px.
- Tamamlama anında küçük kutlama: ilerleme çubuğu yeşile döner + kısa toast "Harika! 🎉 Üslü İfadeler bitti" (tek izin verilen emoji yeri toast'lar).
- Toast bileşeni (`showToast(msg, type)`), onay diyaloğu (`confirmDialog(msg) → Promise<bool>`, `<dialog>` elemanı), modal form bileşeni (`<dialog>`).
- Grafik örnekleri bir `charts` haritasında tutulur; yeniden çizimden önce `chart.destroy()`. Grafik renkleri ders rengi; "kalan" dilimi `var(--muted)` gri. Tema değişince grafikler yeniden çizilir (metin rengi CSS değişkeninden okunur).

## 4. Sekmeler

### 4.1 Genel Durum (veli/öğrenci özeti) — `#genel`
Kartlar (üstten alta):
1. **Geri sayım**: büyük sayı "207 gün", altında sınav adı + tarih (`13 Haziran 2027 Pazar`) + "Yaklaşık N hafta". Veri notu: `nextExam.note`.
2. **Toplam ilerleme**: tüm derslerin item kesirleri toplamı / tüm item'lar → büyük halka (doughnut) + yüzde. Altında "X kitap · Y bölüm · Z tamamlandı".
3. **Ders ders ilerleme**: her görünür ders için yatay çubuk (ders rengi), yüzde, tıklanınca ders sekmesine gider. Kitabı olmayan ders: "Henüz kitap yok — ekle" bağlantısı.
4. **LGS konu kapsama**: her LGS dersi için "tamamlanan konu / toplam konu" ve ağırlıklı kapsama yüzdesi `Σ(avgQuestions×completion)/Σ avgQuestions`.
5. **En zayıf dersler**: LGS dersleri için `ağırlıklı kapsama` en düşük 3 ders (eşitlikte katsayısı yüksek olan önce) + her biri için `priorityScore`'u en yüksek 2 bitmemiş konu. Metin: "Matematik: Kareköklü İfadeler (ort. 3,4 soru) henüz bitmedi".
6. **Bu hafta**: bu haftanın planı varsa tamamlanma halkası (`weekCompletion`) + "12/18 oturum · 9 sa 20 dk"; yoksa "Bu hafta için program yok → Program oluştur". Ayrıca `weekActivity`: "Bu hafta 23 test/bölüm ilerletildi". Son 7 gün mini çubuk grafik (günlük delta toplamı).
7. **Veri durumu** (küçük satır): "LGS verisi: gömülü (18.11.2026)" / "URL'den güncellendi …".
8. Düğmeler: "Yedeği indir", "Yazdır" (`window.print()`; print CSS sekme çubuğunu ve düğmeleri gizler).

### 4.2 Ders sekmesi — `#ders/{subjectId}` (her ders için bir sekme)
Üst bölüm:
- Başlık (ders adı, renk şeridi) + **pasta grafik**: dersin TÜM kitaplarının birleşik ilerlemesi (Tamamlanan vs Kalan), ortada yüzde. Yanında: "3 kitap · 48 bölüm · 21,5 tamamlandı".
- "+ Kitap ekle" düğmesi.

Kitap listesi (kart başına bir kitap):
- Başlık, yayınevi, tür rozeti, ilerleme çubuğu + yüzde + "12/30 bölüm".
- Açılır/kapanır item listesi. Her item satırı:
  - `total===1`: checkbox + başlık.
  - `total>1`: başlık + "5/12 test" + `−` / `+` düğmeleri + mini çubuk; satıra tıklayınca sayı girişi.
  - LGS konusuna bağlıysa küçük etiket (konu adı; yüksek ağırlıksa ★).
  - Her değişiklik `activity`'ye `delta` yazar; `done` total'e ulaşınca `completedAt` set, toast.
- Kitap menüsü (⋯): Düzenle, Bölüm ekle, Toplu bölüm ekle, Arşivle/Geri al, Sil (onaylı), JSON olarak kopyala.

**Kitap ekle/düzenle modalı:**
- Alanlar: Kitap adı (zorunlu), Ders (seçili ders varsayılan), Yayınevi, Tür.
- Bölümler bölümü, 3 yol:
  1. **LGS konularından oluştur** (yalnız LGS dersi): dersin konu listesi checkbox'larla (varsayılan hepsi seçili), her biri için "kaç test/sayfa" sayı alanı ve birim seçimi (ortak birim seçici + konu başı sayı). Oluşan item'lar `lgsTopicId` ile bağlı.
  2. **Elle ekle**: satır satır (başlık, birim, adet, LGS konusu açılır listesi — "Bağlama" seçeneği dahil).
  3. **Toplu yapıştır**: textarea, her satır bir bölüm. Biçim: `Başlık | adet | birim` (adet/birim opsiyonel, varsayılan 1 konu). Örn: `Üslü İfadeler | 12 | test`. Başlık LGS konu adıyla (tr küçük harf, boşluk/noktalama yok sayılarak) eşleşirse `lgsTopicId` otomatik önerilir (kullanıcı değiştirebilir).
- Kaydet: doğrulama (ad boş olamaz, `total≥1` tam sayı, `done≤total`).

Alt bölüm — **Konu durumu** (yalnız LGS dersi): dersin LGS konuları tablosu: Konu · Durum rozeti (Bitti / Devam / Başlanmadı / Kitapta yok) · Tamamlanma % · Ort. LGS sorusu · ★. Durum hücresine tıklayınca elle override menüsü ("Otomatik", "Bitti", "Devam ediyor", "Başlanmadı").
Özel (LGS dışı) dersler: yalnızca kitaplar + pasta; konu tablosu yok.

**+ Ders modalı:** ad, renk; özel ders oluşturur. Ayrıca gizli LGS derslerini yeniden göster seçeneği.

### 4.3 LGS Analiz — `#analiz`
Üstte: veri bilgisi şeridi (`lastUpdated`, kaynak türü, `disclaimer`, `curriculumNote`) + "Veriyi güncelle" düğmesi (bkz. §6) + yıl seçici (çoklu seçim chip'leri, varsayılan `analysisYearsDefault`; `settings.analysisYears`'a kaydedilir).
1. **Sınav yapısı kartı**: oturumlar (soru, süre), ders başına soru sayısı ve katsayı tablosu, yanlış cezası. Ders bazında soru sayısı çubuk grafiği (90 soru).
2. **Ortalama doğru sayıları**: `averageCorrect` çizgi grafiği (ders başına bir çizgi; yüzde olarak `doğru/questionCount` normalize seçeneği).
3. **Ders seçici** (sekmeler/chip'ler: 6 LGS dersi + "Tümü"). Seçilen ders için:
   - **Tablo**: satır = konu; sütunlar = seçili yıllar + `Ort.` + `Durum` + `Öncelik`. Hücreler: sayı; `estimatedYears` içindeyse sayı yanında `~` ve italik, `title="Tahmini değer"`; kapsam dışı yıl (2023 & semester 2) hücresi `—` ve `title="Bu yıl kapsam dışıydı"`. Durum sütunu §2.3 `topicStatus` rozeti. Satır vurgusu: **yüksek ağırlıklı + bitmemiş** konu → turuncu sol kenarlık + açık turuncu zemin + "Öncelikli" rozeti; yüksek ağırlıklı + bitmiş → yeşil ★. Sütun başlığına tıklayınca sıralama.
   - **Grafik**: yığılmış çubuk (x = yıl, yığın = konu) veya gruplu çubuk (x = konu, seri = yıl). Varsayılan: x = konu, y = seçili yılların ortalaması, çubuk rengi durumdan (bitti = ders rengi, devam = ders rengi %60 opak, başlanmadı = gri), yanında "yıllara göre" anahtarı ile gruplu çubuk görünümüne geçiş.
4. **"Bitmemiş yüksek ağırlıklı konular" listesi** (tüm dersler): `priorityScore` azalan ilk 10; her satırda ders rozeti, konu, ort. soru, tamamlanma %, "Programa ekle" düğmesi (bu haftanın planına, en boş güne 40 dk oturum ekler).
5. **Kaynaklar**: `sources` listesi (bağlantılar `target="_blank" rel="noopener"`).

### 4.4 Haftalık Program — `#program`
Üst çubuk: `‹ Önceki hafta` · "16–22 Kasım 2026" · `Sonraki hafta ›` · "Bu hafta". Sağda eylemler:
`Otomatik öneri (AI'sız)` · `AI ile öneri` · `Boş program` · `Kopyala: geçen haftadan` · `Yapıştır / Yükle` · `Dışa aktar` · `Sil`.

**Haftalık ızgara** (takvim benzeri):
- ≥900px: 7 sütun (Pzt…Paz, tarih ile), her sütunda oturum kartları `start` saatine göre sıralı (saat yoksa eklenme sırası). Her sütun altında "+ Oturum". Sütun başlığında gün toplam dakika / `dailyMinutes` (aşım kırmızı).
- <900px: günler dikey liste (bugün açık, diğerleri katlanır akordeon).
- Oturum kartı: ders renkli sol şerit, saat + süre, başlık, (varsa) konu ve kitap adı, **checkbox** (done). İşaretlenince kart soluk + üstü çizili; bağlı `itemId` varsa "Kitapta da 1 test ilerlet?" toast-eylemi (tek tık, otomatik değil).
- Kart tıklama → düzenle modalı: gün, başlangıç saati (opsiyonel), süre (dk), ders, LGS konusu (dersin konuları), kitap + bölüm (dersin kitapları), başlık (boşsa otomatik "Konu — Kitap"), sil.
- Sürükle-bırak opsiyonel: masaüstünde HTML5 drag ile gün değiştirme (zorunlu değil; yapılırsa dokunmatikte modal yeterli).
- Alt bilgi: haftalık tamamlanma çubuğu, ders başına planlanan dakika dağılımı (küçük doughnut).
- Yeni plan mevcut planın üzerine yazacaksa onay iste.

**Otomatik öneri (AI'sız, kural tabanlı)** — `generateRulePlan(weekStart)`:
1. Gün bütçeleri = `profile.dailyMinutes`; sınav o haftadaysa sınav günü ve sonrası 0.
2. Aday konular = LGS konuları, `topicStatus !== 'done'`, `priorityScore` azalan. Kalan gün < 60 ise tekrar ağırlıklı: bitmiş yüksek ağırlıklı konular da "Tekrar: …" olarak aday (skor × 0,5).
3. Ders kotası: haftalık toplam dakikayı `coefficient × questionCount` oranıyla paylaştır (TR/MAT/FEN ağır), her ders en az 1 oturum.
4. Oturum süresi 40 dk; günlük bütçe dolana kadar sırayla (aynı gün aynı dersten en fazla 2 oturum, aynı konu haftada en fazla 3 kez). Her oturuma, konuya bağlı bitmemiş ilk kitap item'ı atanır (`bookId/itemId`), başlık "Konu — Kitap (N test)".
5. Haftada 1 oturum "Deneme / karışık tekrar" (Pazar, 80 dk) eklenir, bütçe yeterse.
6. `source:"rule"`. Sonuç ızgarada önizleme + "Uygula / Vazgeç".

**Yapıştır / Yükle** modalı, 3 sekme:
- *JSON*: `{ "sessions": [...] }` veya tam plan nesnesi (şema §5.2'deki `sessions` öğeleriyle aynı alanlar, `subject` adı veya `subjectId` kabul). Dosya seçici (`.json`) de aynı ayrıştırıcıya gider.
- *Metin*: satır başına bir oturum, biçim: `Gün [Saat] Süre Ders - Açıklama`
  Örnekler: `Pzt 17:00 40 Matematik - Üslü İfadeler 2 test`, `Salı 60 Fen - DNA tekrar`.
  Gün: `Pzt|Pazartesi|Sal|Salı|Çar|Çarşamba|Per|Perşembe|Cum|Cuma|Cmt|Cumartesi|Paz|Pazar` (tr küçük harfle eşleşir). Süre dk (`40`, `40dk`, `1sa`, `1.5sa`). Ders adı mevcut derslerle bulanık eşleşir (ilk 3 harf / `shortName`); eşleşmezse satır hatalı olarak listelenir. Açıklamada LGS konu adı geçerse `lgsTopicId` bağlanır.
- *AI ile dönüştür* (API anahtarı varsa görünür): serbest metin (örn. öğretmenin verdiği program) → AI §5.3 → önizleme.
Tüm yollar: önizleme (hatalı satırlar kırmızı) → "Bu haftaya uygula".

### 4.5 Ayarlar — `#ayarlar`
- Profil: öğrenci adı, LGS tarihi (date input; boş = veriden; "Veriden sıfırla"), günlük çalışma süreleri (7 sayı alanı, dk; "Hafta içi hepsine uygula" kısayolu), tema (Otomatik/Açık/Koyu).
- Yapay zekâ: API anahtarı (`type=password`, göster/gizle), model (metin, varsayılan `claude-sonnet-5-5`), "Bağlantıyı test et" (küçük istek: `max_tokens: 16`, "ping" → başarılıysa toast). Uyarı metni: "Anahtar yalnızca bu tarayıcıda saklanır ve doğrudan Anthropic'e gönderilir. Paylaşılan bilgisayarda kullanmayın. AI istekleri ücretlidir." "Anahtarı sil" düğmesi.
- LGS verisi: aktif kaynak bilgisi, veri URL'si alanı, "Veriyi güncelle" (§6), "Gömülü veriye dön", "Önceki veriye geri al" (`lgsDataMeta.previous` varsa), "Aktif veriyi indir (lgs-data.json)".
- Yedek: "Yedeği indir" (`lgs-takip-yedek-YYYY-MM-DD.json`), "Yedeği yükle" (dosya → doğrula → "Mevcut verilerin yerine geçecek" onayı → yükle → yeniden çiz). "Tüm verileri sil" (iki aşamalı onay; API anahtarı da silinir).
- Yedek biçimi: `{ app: "lgs-takip", backupVersion: 1, exportedAt, state: AppState }`. Yedek dışa aktarımında **apiKey hariç tutulur** (`state.settings.apiKey = ""`). Yüklemede mevcut apiKey korunur.

## 5. Yapay zekâ entegrasyonu

### 5.1 Ortak istemci `callClaude({ system, user, schema, effort, maxTokens, useWebSearch })`
```js
POST https://api.anthropic.com/v1/messages
headers: {
  "content-type": "application/json",
  "x-api-key": settings.apiKey,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
  "anthropic-beta": "server-side-fallback-2026-07-01"
}
body: {
  model: settings.model || "claude-sonnet-5-5",
  max_tokens: maxTokens ?? 16000,
  system,
  messages: [{ role: "user", content: user }],
  fallbacks: "default",                       // ret durumunda sunucu tarafı yedek model
  output_config: { effort: effort ?? "medium",
                   ...(schema ? { format: { type: "json_schema", schema } } : {}) },
  ...(useWebSearch ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }] } : {})
}
```
Kurallar:
- `thinking`, `temperature`, `top_p`, asistan prefill **gönderme** (bu modelde 400 verir / gereksiz).
- `AbortController` ile 180 sn zaman aşımı; istek sürerken düğme devre dışı + "Yapay zekâ düşünüyor…" göstergesi + "İptal".
- **Uyumluluk geri çekilmesi:** HTTP 400 ve hata mesajı `fallbacks` / `anthropic-beta` içeriyorsa bir kez bu ikisi olmadan tekrar dene; `output_config.format` / `json_schema` içeriyorsa bir kez `format` olmadan dene (şema metni zaten prompt'ta). Bu bayrakları oturum boyunca hatırla.
- Hata eşleme (Türkçe toast): 401 "API anahtarı geçersiz", 403 "Yetki yok", 429 "Çok fazla istek; biraz sonra dene", 529/5xx "Servis meşgul; tekrar dene", ağ hatası "Bağlantı yok (çevrimdışı olabilirsin)".
- Yanıt: `stop_reason === "refusal"` → "Yapay zekâ bu isteği yanıtlayamadı."; `"max_tokens"` → "Yanıt yarıda kesildi; daha kısa hafta/az konu ile dene."; `"pause_turn"` (web aramasında) → `messages`'a `{role:"assistant", content: data.content}` ekleyip aynı isteği en fazla 3 kez sürdür.
- Metin çıkarma: `data.content.filter(b => b.type === "text").map(b => b.text).join("")` (thinking/server-tool blokları yok sayılır).
- **Sağlam JSON ayrıştırma `parseJsonLoose(text)`**: (1) `JSON.parse(text.trim())`; (2) ```` ```json … ``` ```` çitini soy ve dene; (3) ilk `{` ile son `}` arasını dene; (4) sondaki virgülleri (`,]` `,}`) temizleyip dene; hepsi başarısızsa hata + ham yanıtı "Ayrıntılar" içinde göster.
- Ayrıştırmadan sonra **her zaman** el yazımı doğrulayıcı (şemaya göre) çalışır; geçersiz öğeler atılır ve sayısı bildirilir. AI çıktısı asla doğrulanmadan state'e yazılmaz; her zaman önizleme → kullanıcı onayı.
- AI özellikleri API anahtarı yoksa gizli değil, **devre dışı** + ipucu: "Ayarlar'dan API anahtarı ekleyince açılır." Uygulamanın geri kalanı AI'sız tam çalışır.

### 5.2 Haftalık program önerisi
`effort: "medium"`, şema `WEEK_PLAN_SCHEMA`:
```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "sessions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "day": { "type": "integer", "enum": [0,1,2,3,4,5,6] },
          "start": { "type": "string" },
          "durationMin": { "type": "integer" },
          "subjectId": { "type": "string" },
          "lgsTopicId": { "type": ["string", "null"] },
          "bookId": { "type": ["string", "null"] },
          "itemId": { "type": ["string", "null"] },
          "title": { "type": "string" },
          "reason": { "type": "string" }
        },
        "required": ["day","start","durationMin","subjectId","lgsTopicId","bookId","itemId","title","reason"],
        "additionalProperties": false
      }
    },
    "tips": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["summary","sessions","tips"],
  "additionalProperties": false
}
```
System prompt (aynen):
```
Sen deneyimli bir Türk ortaokul rehber öğretmeni ve LGS koçusun. 8. sınıf öğrencisi için gerçekçi, uygulanabilir, dengeli bir HAFTALIK çalışma programı hazırlarsın.
Kurallar:
- Yalnızca verilen subjectId, lgsTopicId, bookId ve itemId değerlerini kullan; uydurma kimlik yazma. Uygun kimlik yoksa null ver.
- Her günün toplam süresi o günün dakika bütçesini aşmasın. Oturumlar 30-60 dk; her 2 oturumdan sonra mola varsay (molaları oturum olarak yazma).
- Öncelik: LGS'de çok soru gelen ve henüz bitmemiş konular; katsayısı 4 olan dersler (Türkçe, Matematik, Fen) daha fazla süre alır, ama hiçbir ders tamamen ihmal edilmez.
- Aynı gün aynı dersi en fazla 2 kez koy; zor sayısal konuları günün başına al. Hafta içinde en az bir karışık tekrar/deneme oturumu ekle.
- Sınava 60 günden az kaldıysa tekrar ve deneme oranını artır.
- day: 0=Pazartesi … 6=Pazar. start "HH:MM" biçiminde ya da saat önemsizse "" olsun.
- title kısa ve çocuğun anlayacağı Türkçe olsun (ör. "Üslü İfadeler — 2 test çöz"). reason tek cümle.
- summary 2-3 cümle, tips en fazla 4 kısa motive edici ve pratik öneri.
Yanıtı yalnızca istenen JSON şemasına uygun tek bir JSON nesnesi olarak ver.
```
User mesajı (uygulama doldurur, JSON gömülü):
```
Hafta: {weekStart} (Pazartesi) – {weekEnd}. Bugün: {today}. LGS tarihi: {examDate} ({daysLeft} gün kaldı).
Günlük dakika bütçesi (0=Pzt…6=Paz): {dailyMinutesJSON}
Ek istek (veliden/öğrenciden): {userNote || "yok"}
Dersler ve konular (JSON):
{contextJSON}
```
`contextJSON` = `{ subjects: [{ subjectId, name, coefficient, questionCount, progressPct, topics: [{ lgsTopicId, name, avgQuestions, status, completionPct, highWeight }], books: [{ bookId, title, openItems: [{ itemId, title, lgsTopicId, remaining, unit }] }] }] }` — kısa tutmak için kitap başına en fazla 15 açık item, bitmiş konular yalnızca `{lgsTopicId,name,status:"done"}`. Özel (LGS dışı) dersler `topics: []` ile eklenir.
Program sekmesinde AI düğmesi önce küçük bir modal açar: "Ek istek" textarea (örn. "Çarşamba kursu var, 18:00'den sonra"), Gönder.
Sonrası: doğrula (bilinmeyen subjectId → oturum atılır; bilinmeyen topic/book/item id → null'a çevrilir; `durationMin` 10–180 aralığına kırp; günlük bütçe aşımı uyarı rozeti), `id` ve `done:false` ekle, `source:"ai"`, önizleme (summary + tips gösterilir) → Uygula.

### 5.3 Serbest metin programı JSON'a dönüştürme
`effort: "low"`, şema = `WEEK_PLAN_SCHEMA` (aynı). System:
```
Sana bir öğrencinin haftalık ders çalışma programı serbest metin, tablo veya liste olarak verilecek. Bunu verilen şemaya dönüştür.
Ders adlarını verilen ders listesindeki subjectId değerleriyle eşleştir; eşleşmeyen satırları atla ve summary içinde belirt. Konu adı verilen konu listesinden biriyle açıkça eşleşiyorsa lgsTopicId ver, yoksa null. bookId ve itemId her zaman null. Süre yazmıyorsa 40 dk varsay. reason boş string olabilir, tips boş dizi olabilir.
Yanıtı yalnızca şemaya uygun tek bir JSON nesnesi olarak ver.
```
User: `Ders listesi: {[{subjectId,name,topics:[{lgsTopicId,name}]}]}\n\nProgram metni:\n{pastedText}`.

### 5.4 LGS verisini AI ile yenileme
`effort: "high"`, `useWebSearch: true` (Ayarlar'daki "Web araması kullan" kutusu, varsayılan açık), `maxTokens: 16000`. **Web araması açıkken `format` gönderilmez** (yalnız prompt + sağlam ayrıştırma); kapalıyken şema `DATA_REFRESH_SCHEMA` ile gönderilir.
`DATA_REFRESH_SCHEMA` (yalnız güncellenebilir alanlar; dinamik anahtar yerine dizi):
```json
{
  "type": "object",
  "properties": {
    "nextExam": { "type": "object", "properties": {
        "name": {"type":"string"}, "date": {"type":"string"}, "status": {"type":"string","enum":["announced","estimated"]}, "note": {"type":"string"} },
      "required": ["name","date","status","note"], "additionalProperties": false },
    "years": { "type": "array", "items": { "type": "integer" } },
    "subjects": { "type": "array", "items": { "type": "object", "properties": {
        "id": {"type":"string"},
        "topics": { "type": "array", "items": { "type": "object", "properties": {
            "id": {"type":"string"},
            "counts": { "type": "array", "items": { "type": "object", "properties": {
                "year": {"type":"integer"}, "count": {"type":"integer"}, "estimated": {"type":"boolean"} },
              "required": ["year","count","estimated"], "additionalProperties": false } } },
          "required": ["id","counts"], "additionalProperties": false } } },
      "required": ["id","topics"], "additionalProperties": false } },
    "sources": { "type": "array", "items": { "type": "object", "properties": {
        "title": {"type":"string"}, "url": {"type":"string"}, "usedFor": {"type":"string"} },
      "required": ["title","url","usedFor"], "additionalProperties": false } },
    "changeSummary": { "type": "string" }
  },
  "required": ["nextExam","years","subjects","sources","changeSummary"],
  "additionalProperties": false
}
```
System:
```
Sen LGS (Liselere Geçiş Sistemi) verilerini derleyen titiz bir eğitim araştırmacısısın. Görevin: verilen mevcut veri setini güncellemek.
- Konu ve ders kimliklerini (id) DEĞİŞTİRME, yeni konu ekleme, konu silme. Yalnızca soru sayılarını, yılları, sınav tarihini ve kaynakları güncelle.
- Her ders için her yılın konu toplamı dersin soru sayısına eşit olmalı (Türkçe/Matematik/Fen 20, diğerleri 10).
- MEB konu bazlı dağılım yayımlamaz; üçüncü taraf sınıflandırmalar çelişiyorsa en çok tekrarlanan değeri seç ve estimated=true yap. Emin olmadığın her değer estimated=true.
- 2023 sınavında yalnızca 1. dönem konuları kapsamdaydı; 2. dönem konuları o yıl 0'dır.
- Sınav tarihi resmî olarak (MEB/ÖDSGM) açıklandıysa status="announced", değilse "estimated".
- Uydurma kaynak yazma; yalnızca gerçekten kullandığın URL'leri ver.
- changeSummary: Türkçe, en fazla 5 madde halinde neyin değiştiği.
Yanıtı yalnızca şu yapıda tek bir JSON nesnesi olarak ver (açıklama metni yazma): {SCHEMA_JSON}
```
(`{SCHEMA_JSON}` yer tutucusu `JSON.stringify(DATA_REFRESH_SCHEMA)` ile doldurulur.)
User: `Bugün: {today}. Son {5} LGS sınavının (en son yapılan dahil) konu bazlı soru sayılarını ve bir sonraki LGS tarihini güncelle.\nMevcut veri (kısaltılmış):\n{JSON: nextExam, years, subjects[{id,name,questionCount,topics[{id,name,semester,counts}]}]}`.
Uygulama: yanıtı mevcut verinin **kopyası** üzerine birleştir (`mergeRefresh(current, refresh)`): eşleşen subject/topic id'lerinin `counts`'unu yıl yıl yaz, `estimatedYears`'ı `estimated` bayraklarından yeniden kur; bilinmeyen id'leri yok say; `years` = birleşik sıralı küme; `analysisYearsDefault` = son 5 yıl; `nextExam` alanlarını yaz; `sources` = yeni + eski (url'e göre tekil); `lastUpdated` = bugün; `dataSource = "ai"`. Sonra `validateLgsData` → §6 önizleme.

## 6. "Veriyi güncelle" akışı (resmî API yok)
Analiz sekmesi ve Ayarlar'daki düğme bir modal açar, 3 seçenek:
- **(a) URL'den al**: `settings.dataUrl` (düzenlenebilir alan). `fetch(url, { cache: "no-store" })` → `res.json()` → `validateLgsData`. Not metni: "Adres CORS'a izin veren bir JSON olmalı (örn. GitHub raw/Gist). Biçim: lgs-data.json ile aynı." Ağ/CORS hatası → anlaşılır mesaj.
- **(b) Yapay zekâ ile yenile**: §5.4 (API anahtarı gerekir; maliyet uyarısı: "Web aramalı istek birkaç kuruş–birkaç lira tutabilir").
- **(c) Dosyadan yükle**: `<input type=file accept=".json">` → `FileReader` → aynı doğrulama.
Ortak **önizleme/fark ekranı**: kaynak, `lastUpdated`, `nextExam.date` değişikliği, eklenen yıllar, değişen konu sayıları tablosu (ders · konu · yıl · eski → yeni), doğrulama uyarıları, AI ise `changeSummary`. Düğmeler "Uygula" / "Vazgeç". Uygula: `lgsDataMeta.previous = aktif veri`, `state.lgsDataOverride = yeni`, `lgsDataMeta.source/appliedAt` set, tüm görünümler yeniden çizilir.
Kimlik kayması koruması: kullanıcı item'larının `lgsTopicId` değerleri yeni veride yoksa uyarı listele ("3 bölümün konu bağlantısı yeni veride bulunamadı"); bağlantılar silinmez, analizde "bilinmeyen konu" olarak sayılmaz.

## 7. Kod organizasyonu (`index.html` içinde)
Tek `<script>` içinde bölümler (yorum başlıklarıyla), global ad alanı kirletilmeden (IIFE veya `const App = {}`):
1. `utils` — `$`, `el(tag, attrs, children)`, `escapeHtml`, `uid`, `clamp`, `localDateKey`, `weekStartKey`, `addDays`, `fmtDate`, `fmtMin` ("1 sa 20 dk"), `trLower`, `normalizeTr` (eşleştirme için: tr küçük harf, aksan koruyan, noktalama/boşluk silen), `debounce`, `downloadJson(name, obj)`, `readFileAsText(file)`.
2. `store` — `loadState`, `saveState`, `defaultState(lgsData)`, `migrateState`, `exportBackup`, `importBackup`.
3. `lgs` — `getEmbeddedData`, `getLgsData`, `validateLgsData`, `mergeRefresh`, `diffLgsData`, `topicWeight`, `isHighWeight`.
4. `progress` — §2.3 fonksiyonları, `recordActivity`.
5. `planner` — `generateRulePlan`, `parsePlanText`, `normalizePlanSessions` (AI/JSON çıktısını doğrula+temizle).
6. `ai` — `callClaude`, `parseJsonLoose`, şema sabitleri, prompt şablonları, `aiSuggestWeek`, `aiConvertText`, `aiRefreshData`, `aiTest`.
7. `charts` — `renderPie(canvasHost, parts)`, `renderBar`, `renderLine`, `renderDoughnutRing`; Chart yoksa CSS yedeği.
8. `ui` — `showToast`, `confirmDialog`, `openModal`, sekme çubuğu, router.
9. `views` — `renderDashboard`, `renderSubject(id)`, `renderAnalysis`, `renderProgram`, `renderSettings`, modallar (`bookModal`, `sessionModal`, `pasteModal`, `dataUpdateModal`, `subjectModal`).
10. `init` — veri yükle, tema uygula, router başlat, `storage` olayıyla çoklu sekme senkronu (başka sekme kaydederse yeniden yükle).
Yeniden çizim stratejisi: durum değişince yalnızca aktif görünüm yeniden render edilir (`rerender()`); sekme çubuğu ve rozet her zaman güncellenir.

## 8. Kabul kontrol listesi (gözden geçiren için)
**Genel**
- [ ] Tek `index.html`; `file://` ile açılıyor; konsolda hata yok. İnternet yokken (Chart.js yüklenmeden) tüm sekmeler CSS yedeği grafiklerle çalışıyor.
- [ ] Chart.js tam olarak `cdnjs …/Chart.js/4.4.1/chart.umd.min.js`; başka dış kaynak yok.
- [ ] `lgs-data.json` içeriği gömülü ve `lgs-data.json` dosyasıyla birebir aynı.
- [ ] Tüm metinler Türkçe; İ/ı içeren aramalar/eşleşmeler doğru (ör. "İNKILAP" ↔ "inkılap").
- [ ] 375px genişlikte yatay kaydırma yok; sekme çubuğu kaydırılabilir; açık/koyu tema ve "Otomatik" çalışıyor.
- [ ] Sayfa yenilenince tüm veriler korunuyor; localStorage kapalıysa uyarı şeridi çıkıyor, uygulama çökmüyor.

**Kitaplar ve dersler**
- [ ] İlk açılışta 6 LGS dersi sekmesi var; özel ders eklenebiliyor, LGS dersi gizlenip geri gösterilebiliyor.
- [ ] Kitap eklenebiliyor: LGS konularından oluştur / elle / toplu yapıştır (`Üslü İfadeler | 12 | test` → 12 testlik, konuya bağlı item).
- [ ] Item checkbox ve +/− sayaçları çalışıyor; `done` 0..total sınırında; tamamlanınca toast.
- [ ] Ders sekmesindeki pasta, dersin tüm kitaplarının birleşik ilerlemesini gösteriyor; kitap kartlarında ayrı ilerleme var. Elle kontrol: 2 kitap, item kesirleri (1, 0.5, 0) ve (1) → %62,5.
- [ ] Konu durumu tablosu otomatik durumu ve elle override'ı doğru gösteriyor; override "Otomatik"e dönebiliyor.

**LGS Analiz**
- [ ] Ders başına soru sayıları (20/20/20/10/10/10), oturum süreleri, katsayılar görünüyor.
- [ ] Konu tablosu seçili yılları gösteriyor; tahmini değerler `~` ile, 2023 2. dönem hücreleri `—` ile işaretli ve ortalamaya katılmıyor (ör. Matematik Doğrusal Denklemler 2022–2026 ortalaması = (4+3+3+3)/4 = 3,3).
- [ ] Grafik konu ortalamalarını durum rengine göre gösteriyor; yıllara göre görünüme geçiliyor.
- [ ] Bitmemiş yüksek ağırlıklı konular vurgulu ve "öncelikli" listesinde `priorityScore` sırasıyla; bir konu kitapta bitirilince vurgu kalkıyor.
- [ ] Veri bilgisi, uyarı (disclaimer), müfredat notu ve kaynak bağlantıları görünüyor.

**Veri güncelleme**
- [ ] URL / dosya / AI yollarının üçü de önizleme-fark ekranına düşüyor; geçersiz JSON reddediliyor ve sebebi gösteriliyor.
- [ ] Uygula sonrası analiz yeni veriyle çiziliyor; "Önceki veriye geri al" ve "Gömülü veriye dön" çalışıyor.

**Haftalık program**
- [ ] Hafta gezinme doğru (Pazartesi başlangıç, yerel tarih; Pazar gece yarısı kayması yok).
- [ ] Manuel oturum ekle/düzenle/sil/işaretle çalışıyor; gün toplamı bütçeyi aşınca kırmızı.
- [ ] Kural tabanlı öneri AI olmadan program üretiyor; günlük bütçeyi aşmıyor; katsayı 4 derslere daha çok süre veriyor.
- [ ] Metin yapıştırma (`Pzt 17:00 40 Matematik - Üslü İfadeler`) ve JSON yükleme önizlemeyle uygulanıyor; hatalı satırlar listeleniyor.
- [ ] Geçen haftadan kopyala çalışıyor (done'lar sıfırlanır).

**Yapay zekâ**
- [ ] API anahtarı yokken AI düğmeleri devre dışı ve ipucu var; anahtar girilince "Bağlantıyı test et" başarılı.
- [ ] İstekte başlıklar: `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`; model varsayılanı `claude-sonnet-5-5`; `temperature`/`thinking`/prefill yok.
- [ ] AI haftalık önerisi önizlemede summary+tips ile gösteriliyor; uydurma id'ler temizleniyor; onaysız state'e yazılmıyor.
- [ ] Kod çitli / önünde metin olan JSON yanıtları da ayrıştırılıyor; ayrıştırılamazsa ham yanıt gösteriliyor.
- [ ] 401/429/ağ hatası/iptal/zaman aşımı anlaşılır Türkçe mesaj veriyor.

**Genel Durum ve yedek**
- [ ] Geri sayım `13 Haziran 2027` için doğru gün sayısını veriyor; Ayarlar'dan tarih değişince güncelleniyor.
- [ ] Toplam ilerleme, en zayıf 3 ders ve öncelikli konuları, bu haftanın tamamlanması ve son 7 gün etkinliği doğru.
- [ ] Yedek indir → tüm verileri sil → yedek yükle ile her şey geri geliyor; yedek dosyasında API anahtarı yok.
- [ ] Yazdır görünümü sade (sekme çubuğu/düğmeler gizli).

## 9. Kapsam dışı
Deneme sınavı net takibi, çoklu kullanıcı/bulut senkronu, bildirimler, puan/yüzdelik hesaplama, akış (streaming) AI yanıtları.

# Turkish glossary

Key terms for `messages/tr.json`. Approved by the owner on 2026-11-14 in the Turkish review, with the owner's
corrections from the same review applied. Tone: "sen". Every Turkish string uses these terms.

| English | Türkçe | Note |
| --- | --- | --- |
| Today / Yesterday | Bugün / Dün | |
| Log (tab) | Ekle | "Kaydet" is the Save button. |
| Journal (tab) | Takvim | "Günlük" also means daily and is used for the diary. |
| Progress | Gelişim | |
| More | Diğer | |
| Budget | Bütçe | |
| Goal | Hedef | |
| Deficit | Açık | Short for "kalori açığı". |
| Activity | Aktivite | Fits the budget card's pill: measured as wide as "Activity" at 375 pt (the review page's phone was drawn narrower). The pill never moves (owner). |
| To log (food) | Kaydetmek | |
| Entry | Girdi | Owner's correction (review: "Kaydettiğin girdiler günlüğünde kalır"). |
| Diary | Günlük | |
| Meal | Öğün | |
| Breakfast, Lunch, Dinner, Snacks | Kahvaltı, Öğle yemeği, Akşam yemeği, Ara öğün | Full names. |
| Food | Yiyecek | |
| Recipe | Tarif | |
| Saved meal | Kayıtlı öğün | |
| Log calories only | Yalnızca kalori kaydet | |
| Portion / serving | Porsiyon | |
| Household measure | Ev ölçüsü | |
| Speak | Söyle | |
| Scan a label | Tara | Owner's correction. |
| Type it | Yaz | |
| Nutrients | Besin değerleri | |
| Protein, Carbs, Fat | Protein, Karbonhidrat, Yağ | |
| Fibre, Sugars, Saturated fat, Salt | Lif, Şeker, Doymuş yağ, Tuz | |
| Unknown | Bilinmiyor | Never shown as 0. |
| Only (in food names, "meat only") | yalnızca | Owner's correction: "yalnızca et", not "yalnız et". |
| Water | Su | |
| Weight | Kilo | |
| Weigh-in | Kilo girdisi | Owner's correction; the button is "Yeni kilo". |
| Latest weigh-in (Progress switch and caption) | Son kilo | Owner, 2026-11-14 (not "Son tartı" or "Klasik"). |
| A single weigh-in (one reading) | Tek bir ölçüm | |
| Smoothed weight | Dengelenmiş kilo | |
| Pace | Hız | |
| Mark the day complete (switch) | Günü tamamla | Owner's correction. |
| Day complete (status) | Gün tamamlandı | Follows from the switch. |
| Other amount (water) | Miktar gir | Owner, 2026-11-14: the field also takes small amounts. |
| Day note | Gün notu | |
| Achievements | Başarılar | |
| Streak | Seri | |
| Members (the people using this server; the admin page) | Kullanıcılar | Owner, 2026-11-14: replaces Household / Ev halkı, which didn't fit friends. "Üyeler" sounds like an organisation's membership. |
| Member (one) | Kullanıcı | |
| Passkey | Geçiş anahtarı | |
| Recovery code | Kurtarma kodu | |
| Sign in | Giriş yap | |
| Waiting to sync | Gönderilmeyi bekliyor | |
| Reminder | Hatırlatma | |
| Recently deleted | Son silinenler | |
| Undo | Geri al | |
| Export / Import | Dışa aktar / İçe aktar | |
| Settings, Profile, Help | Ayarlar, Profil, Yardım | |

Other decisions from the review: the Journal's day box shows the full month ("10 Kasım Salı"); number fields accept
a period or a comma without saying so; the "Yıl sınırında eksen" title was only a caption on the review page, not app
text (the chart axis itself shows "Kas · Ara · Oca ’27 · Şub").

## Help answers (owner's wording, 2026-11-14)

**Günlük bütçem nasıl hesaplanıyor?**

Hareketsiz bir günde vücudunun bir gün içinde harcadığı enerjiye, aktif olarak harcadığın kaloriler eklenir ve
hedefin için gereken açık çıkarılır:

Bütçe = temel harcama (BMR × yaklaşık 1,2) + aktivite − açık

BMR için Mifflin-St Jeor; vücut yağ oranını girersen de Katch-McArdle hesaplama yöntemleri kullanılır. Açık, seçtiğin
haftalık kayba göre belirlenir: bu da kilo başına yaklaşık 7700 kcal demektir. Haftada 1 kg'ı ya da kilonun %1'ini
(hangisi azsa) geçmez. Bütçe hiçbir zaman alt sınırının altına inmez; alt sınırı Profil ve hedef ekranında
ayarlayabilirsin. Geçmiş günler kendi bütçesini korur.

**"Dengelenmiş kilo" nedir?**

Dengelenmiş kilo, su, tuz ve yemekten gelen günlük iniş çıkışları ayıklanmış kilodur. Her yeni kilo girdisi,
dengelenmiş kiloyu biraz değiştirir. Bu hesaplama yöntemi senin hızını da izler, bu yüzden düzenli kilo verirken
geride kalmaz.

Simüle edilmiş geçmiş kilo girdilerinde yapılan testlerde, dengelenmiş kilo gerçek kilodan yaklaşık 0,3 kilo
farklıydı. Bu fark, tek ölçümle elde edilmiş kiloda ise 0,5'e çıkıyor. Yani dengelenmiş kilo, yeterli veri
olduğunda, tek bir ölçüme göre kilo alma veya verme trendinle ilgili sana daha doğru bir bilgi sunuyor.

Gelişim ekranında, kilo grafiğinin üstündeki bölümde Son kilo ile Dengelenmiş arasında geçiş yapabilirsin.

The rest of Help follows this tone.

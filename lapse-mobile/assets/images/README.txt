Lapse image pack v2 (clean redraw)

Semua aset digambar ulang sebagai vector (folder svg-source/) lalu dirender ke PNG
resolusi tinggi dengan transparansi asli (tanpa checkerboard, tanpa border panel).

Ukuran:
- branding/        logo-mark, logo-text, logo-text-dark, logo-white, app-icon: 1024x1024
                   favicon 256x256, adaptive-icon-foreground 1024x1024 (transparan, safe zone Android)
                   app-icon-rounded-preview.png hanya untuk preview, jangan dipakai di app.json
- status/          1024x1024 transparan
- empty-states/    1024x1024 transparan
- onboarding/      onboarding-1..3: 1024x1024 transparan; splash: 1284x2778
- backgrounds/     1080x1920 (opaque)
- placeholders/    avatar-placeholder 512x512 (lingkaran, sudut transparan)

Catatan:
- empty-items dan empty-search sebelumnya tertukar (folder+kaca pembesar = search, kotak kosong = items). Sudah dibenerin.
- logo-text = teks putih (untuk background gelap). logo-text-dark = teks gelap (untuk background terang).
- Untuk Expo production splash tetap disarankan compose di app dengan logo-mark + warna background.
- Ikon UI tetap pakai Lucide React Native; gambar kategori/master item tetap dari Supabase Storage.

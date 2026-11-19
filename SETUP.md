# Bentai Dubber - Setup (sab free)

## 1. Supabase (login + database)
1. supabase.com par project banao.
2. SQL Editor mein `supabase/schema.sql` ka poora code paste karke Run karo.
3. Authentication > Providers > Email: "Confirm email" band kar do (simple rakhna ho to).
4. Project Settings > API se 3 cheezein lo: Project URL, anon public key, service_role key.
5. `js/config.js` mein URL aur **anon** key daalo. service_role key kisi file mein mat daalna.

## 2. Cloudflare R2 (video storage)
1. Cloudflare > R2 > bucket banao (jaise `bentai-videos`).
2. Bucket Settings > Public Development URL (r2.dev) enable karo. Wo link `R2_PUBLIC_URL` hai.
3. Bucket Settings > CORS Policy: AllowedOrigins mein apni site ka URL, AllowedMethods `GET`, AllowedHeaders `*`.
4. R2 > Manage API Tokens se token banao (Object Read & Write). Account ID, Access Key, Secret Key note karo.

## 3. Vercel (hosting)
1. Is poore folder ko GitHub par daalo, Vercel mein Import karo.
2. Settings > Environment Variables mein `.env.example` ki saari values daalo.
   - `AROLINKS_API_KEY`: Arolinks dashboard > Tools/API se token.
   - `KEY_SECRET`: koi lamba random string. Baad mein badalna mat, warna purane videos nahi chalenge.
   - `ADMIN_EMAILS`: aapka email (isi se admin panel khulega).
3. Deploy karo. Pehle site par signup karo, phir `/admin.html` kholo.

## 4. Episode upload (har episode ke liye)
1. Admin panel mein Anime add karo, phir Episode add karo. Panel ek command dega.
2. Computer par ffmpeg, openssl aur aws cli chahiye. Terminal mein:
```
export KEY_SECRET=wahi-secret-jo-vercel-mein-hai
export SITE_URL=https://your-site.vercel.app
export R2_BUCKET=bentai-videos
export R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
export AWS_ACCESS_KEY_ID=<r2-access-key>
export AWS_SECRET_ACCESS_KEY=<r2-secret-key>
export AWS_DEFAULT_REGION=auto
./tools/encode.sh episode1.mp4 <admin-panel-wali-episode-id>
```
Script video ko 720p mein compress, encrypt aur R2 par upload kar deti hai (Windows par Git Bash ya WSL use karo).

## Flow
Home > Anime > Episode click > Arolinks complete > wapas aate hi video chalta hai > 1 ghante baad lock.

## Zaroori baatein
- Arolinks ka API URL/format dashboard ke "API" page se match kar lena. Default `https://arolinks.com/api?api=KEY&url=LINK` hai.
- Encryption sirf casual download rokta hai. Screen recording ya bypass tools ko poori tarah nahi rok sakta. User ka naam watermark isi liye hai.
- Sirf wahi dubbing upload karo jiske aapke paas rights hain.
- iPhone par video ke liye iOS 17.1+ chahiye.

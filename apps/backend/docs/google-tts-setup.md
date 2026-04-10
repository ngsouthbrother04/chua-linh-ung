# Huong Dan Cau Hinh Google TTS (De Hieu, Chay Nhanh)

Tai lieu nay dung cho backend trong thu muc apps/backend.
He thong hien tai chi dung Google Cloud Text-to-Speech.

## 1. Muc tieu

- Cau hinh backend de sinh audio tu noi dung POI bang Google TTS.
- Kiem tra cau hinh hop le truoc khi chay app.
- Biet cach xu ly cac loi thuong gap.

## 2. Chuan bi truoc

- Da cai dependencies backend.
- Co tai khoan Google Cloud va da bat Text-to-Speech API.
- Co service account co quyen dung TTS.

## 3. Cau hinh .env toi thieu

Trong file .env, can it nhat cac bien sau:

- TTS_PROVIDER="google"
- TTS_SUPPORTED_LANGUAGES="vi,en,ko,ja,fr,de,es,pt,ru,zh,id,hi,ar,tr"

Ban chon 1 trong 2 cach cap credentials:

Cach A: Dung duong dan file key

- GOOGLE_APPLICATION_CREDENTIALS="D:/path/to/service-account.json"

Cach B: Nhung JSON truc tiep vao env

- GOOGLE_TTS_CREDENTIALS_JSON="{...json service account...}"

Luu y:

- Chi can 1 trong 2 cach la du.
- Neu dat ca 2, backend uu tien credentials nhung truc tiep.

## 4. Cau hinh tuy chon (nen biet)

- GOOGLE_TTS_VOICE_MAP: map ngon ngu -> ten voice cu the.
  Vi du: {"vi":"vi-VN-Wavenet-A","en":"en-US-Wavenet-D"}
- GOOGLE_TTS_SPEAKING_RATE: toc do doc, mac dinh 1.
- GOOGLE_TTS_PITCH: cao do giong doc, mac dinh 0.
- TTS_LOCAL_AUDIO_DIR: thu muc luu file audio local.
- TTS_PUBLIC_BASE_URL: duong dan public de frontend truy cap audio.

Neu khong khai bao voice map, backend se tu chon theo language code.

## 5. Kiem tra cau hinh

Chay lenh:

- npm run tts:validate

Neu cau hinh dung, script se bao hop le.

## 6. Chay backend

- npm run dev

Hoac build truoc khi deploy:

- npm run build

## 7. Loi thuong gap va cach xu ly nhanh

1. Loi thieu credentials

- Kiem tra GOOGLE_APPLICATION_CREDENTIALS hoac GOOGLE_TTS_CREDENTIALS_JSON.

2. Loi voice map khong hop le

- Kiem tra GOOGLE_TTS_VOICE_MAP co dung dinh dang JSON object.

3. Tao duoc POI nhung khong co audio

- Kiem tra TTS_SUPPORTED_LANGUAGES co chua ngon ngu dang dung.
- Kiem tra log backend khi goi tts-preview.

## 8. Ghi chu van hanh

- Queue mode van giu nguyen: co REDIS_URL thi dung BullMQ, khong co thi fallback in-memory.
- Audio van luu local theo TTS_LOCAL_AUDIO_DIR.
- Endpoint preview va luong tao audio POI deu dung cung runtime Google TTS.

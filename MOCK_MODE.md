# SetClapp Mock Mode

Bu versiyada real backend/API istifadə edilmir.

- Bütün `/api/...` Axios çağırışları `src/mock/mock.api.ts` daxilində tutulur.
- Demo məlumatları `src/mock/mock.data.ts` faylındadır.
- Mock dəyişiklikləri brauzerin `sessionStorage`-ında saxlanılır və yeni sessiyada default dataya qayıdır.
- `vite.config.ts` daxilində backend proxy yoxdur.

## Demo girişləri

### Super Admin
- Email: `superadmin@setclapp.az`
- Kod: `123456`
- VÖEN: boş saxlayın

### Company Admin
- Email: `admin@setclapp.az`
- Kod: `123456`
- VÖEN: `1234567891`

### Employee
- Email: `employee@setclapp.az`
- Kod: `123456`
- VÖEN: `1234567891`

Əlavə employee:
- `nigar@setclapp.az` / `123456` / `1234567891`
- `murad@caspian-demo.az` / `123456` / `9876543210`

## İşə salmaq

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

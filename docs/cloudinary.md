Room image uploads are **not** configured in this repo anymore (the local admin UI was removed). On the centralized backend, managers use the platform’s Cloudinary/signature flow (see that server’s `api.md` and manager `/api/manager/rooms/*` routes).

Previously this repo used: admin UI → `GET /api/admin/cloud-signature` → signed upload to Cloudinary.

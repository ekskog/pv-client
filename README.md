# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## Backend API

This frontend connects to the [PhotoVault API](https://github.com/ekskog/photovault-api) which provides:

- `GET /buckets` - List buckets
- `POST /buckets` - Create bucket
- `GET /buckets/:bucketName/objects` - List objects/folders
- `POST /buckets/:bucketName/upload` - Upload files
- `POST /buckets/:bucketName/folders` - Create folder
- `DELETE /buckets/:bucketName/folders` - Delete folder

API uses MinIO storage backend and returns JSON responses.

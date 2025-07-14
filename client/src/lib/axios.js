import axios from 'axios';

export const api = axios.create({
  baseURL: '',            // vite dev 서버에서는 ''(동일 origin)
  withCredentials: true,
});

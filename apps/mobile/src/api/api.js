import axios from "axios";

const API = axios.create({
  baseURL: "http://192.168.1.15:3000/api/v1", // Thêm /api/v1 vào đây
});

export default API;
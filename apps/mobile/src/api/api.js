import axios from "axios";

const API = axios.create({
  // baseURL: "http://192.168.1.15:3000/api/v1", 
  // Sửa thành IP mới từ ipconfig của bạn
  baseURL: "http://192.168.1.53:3000/api/v1",
});

export default API;

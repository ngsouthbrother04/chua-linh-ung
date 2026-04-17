import axios from "axios";

const API = axios.create({
  baseURL: "http://192.168.1.15:3000/api/v1", //Tuấn
  // Sửa thành IP mới từ ipconfig của bạn
  // baseURL: "http://192.168.58.251:3000/api/v1",
});

export default API;

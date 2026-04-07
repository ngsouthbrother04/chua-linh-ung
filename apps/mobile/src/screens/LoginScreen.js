import { View, Text, TextInput, Button } from "react-native";
import { useState } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage'; // 1. THÊM DÒNG NÀY
import API from "../api/api";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const res = await API.post("/auth/login", {
        email,
        password,
      });

      console.log("Dữ liệu trả về:", res.data);

      // 2. THÊM Ở ĐÂY: Lưu token vào bộ nhớ máy
      // Lưu ý: Kiểm tra xem Backend trả về tên là 'token' hay 'accessToken'
// Trong hàm handleLogin, đoạn sau khi console.log(res.data)
    if (res.data && res.data.accessToken) {
        await AsyncStorage.setItem('userToken', res.data.accessToken);
        console.log("Đã lưu Access Token thành công!");
    }

      navigation.navigate("Home");
    } catch (err) {
      // 3. NÊN SỬA LẠI ĐỂ XEM LỖI CHI TIẾT TỪ SERVER
      if (err.response) {
        console.log("Lỗi Server (500/401):", err.response.data);
      } else {
        console.log("Lỗi kết nối:", err.message);
      }
    }
  };

  return (
    <View style={{ padding: 20 }}>
      {/* ... giữ nguyên phần UI bên dưới ... */}
      <Text style={{ fontSize: 22, marginBottom: 20 }}>Login</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, marginBottom: 10, padding: 10 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        secureTextEntry={true}
        onChangeText={setPassword}
        style={{ borderWidth: 1, marginBottom: 10, padding: 10 }}
      />
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}
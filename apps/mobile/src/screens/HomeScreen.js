import React, { useState, useEffect, useRef } from "react";
import { 
  View, Text, StyleSheet, Dimensions, TextInput, 
  ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Modal, Alert, StatusBar, TouchableWithoutFeedback 
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from "react-native-maps";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { CommonActions } from '@react-navigation/native';
import API from "../api/api";
import { autoTranslate } from "../utils/translator";
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get("window");

const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', locale: 'vi-VN' },
  { code: 'en', name: 'English', flag: '🇺🇸', locale: 'en-US' },
  { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭', locale: 'th-TH' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', locale: 'ja-JP' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', locale: 'ko-KR' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', locale: 'fr-FR' },
];

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};

export default function HomeScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [pois, setPois] = useState([]);
  const [filteredPois, setFilteredPois] = useState([]);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState({ latitude: 10.7712, longitude: 106.6901 });

  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLangModalVisible, setIsLangModalVisible] = useState(false);
  
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [translatedData, setTranslatedData] = useState({ name: "", desc: "" });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [uiLabels, setUiLabels] = useState({
    searchPlaceholder: "Tìm kiếm địa điểm...",
    profileTitle: "Trang cá nhân",
    profileLink: "Hồ sơ cá nhân",
    scanQR: "Quét QR",
    logout: "Đăng xuất",
    details: "THÔNG TIN CHI TIẾT",
    listen: "🔊 NGHE THUYẾT MINH",
    stop: "⏹ DỪNG PHÁT",
    closeMenu: "Đóng menu",
    langTitle: "Chọn Ngôn Ngữ"
  });

  const [userData, setUserData] = useState({ name: "Người dùng", email: "" });
  const mapRef = useRef(null);
  const lastPlayedPoiId = useRef(null);
  const lastPlayedTimestamp = useRef({});

  useEffect(() => {
    fetchPois();
    loadUserData();
    const unsubscribe = navigation.addListener('focus', loadUserData);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const translateUI = async () => {
      if (lang.code === 'vi') {
        setUiLabels({
          searchPlaceholder: "Tìm kiếm địa điểm...",
          profileTitle: "Trang cá nhân",
          profileLink: "Hồ sơ cá nhân",
          scanQR: "Quét QR",
          logout: "Đăng xuất",
          details: "THÔNG TIN CHI TIẾT",
          listen: "🔊 NGHE THUYẾT MINH",
          stop: "⏹ DỪNG PHÁT",
          closeMenu: "Đóng menu",
          langTitle: "Chọn Ngôn Ngữ"
        });
        navigation.setOptions({ title: "🏠 Trang chủ" });
      } else {
        try {
          const keys = Object.keys(uiLabels);
          const values = Object.values(uiLabels);
          const translatedValues = await Promise.all(
            values.map(val => autoTranslate(val.replace(/🔊 |⏹ /g, ""), lang.code))
          );
          const newLabels = {};
          keys.forEach((key, index) => {
            let prefix = "";
            if (key === "listen") prefix = "🔊 ";
            if (key === "stop") prefix = "⏹ ";
            newLabels[key] = prefix + translatedValues[index];
          });
          setUiLabels(newLabels);
          const translatedHome = await autoTranslate("Trang chủ", lang.code);
          navigation.setOptions({ title: `🏠 ${translatedHome}` });
        } catch (e) { console.log("Lỗi dịch UI:", e); }
      }
    };
    translateUI();
  }, [lang]);

  useEffect(() => {
    if (selectedPoi) handleAutoTranslate();
  }, [selectedPoi, lang]);

  useEffect(() => {
    checkGeofencing();
  }, [userLocation]);

  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Lỗi", "Bạn cần cấp quyền Camera");
        return;
      }
    }
    setIsScannerVisible(true);
    setScanned(false);
  };

const handleBarCodeScanned = async ({ data }) => {
  if (scanned) return;
  setScanned(true);
  setIsScannerVisible(false);

  const foundPoi = pois.find(p => p.id.toString() === data.trim());
  if (foundPoi) {
    setSelectedPoi(foundPoi);
    lastPlayedPoiId.current = foundPoi.id;

    // --- LOGIC DỊCH THÔNG BÁO ---
    let successTitle = "Thành công";
    let foundMsg = "Đã tìm thấy";
    
    // Lấy tên gốc (ưu tiên tiếng Việt từ Object)
    const originName = typeof foundPoi.name === 'object' 
      ? (foundPoi.name?.vi || foundPoi.name?.en || "") 
      : foundPoi.name;

    let finalName = originName;

    if (lang.code !== 'vi') {
      try {
        // 1. Dịch tiêu đề và nội dung thông báo
        successTitle = await autoTranslate(successTitle, lang.code);
        foundMsg = await autoTranslate(foundMsg, lang.code);

        // 2. Lấy tên đã dịch (Nếu DB có sẵn thì lấy, không thì gọi API dịch)
        if (typeof foundPoi.name === 'object' && foundPoi.name[lang.code]) {
          finalName = foundPoi.name[lang.code];
        } else {
          finalName = await autoTranslate(originName, lang.code);
        }
      } catch (e) {
        console.log("Lỗi dịch thông báo quét QR:", e);
      }
    }

    // Hiển thị Alert đã được dịch
    Alert.alert(successTitle, `${foundMsg}: ${finalName}`);

    // Di chuyển bản đồ
    mapRef.current?.animateToRegion({
      latitude: foundPoi.latitude,
      longitude: foundPoi.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005
    }, 1000);

  } else {
    // Tương tự cho thông báo không tìm thấy
    let errorTitle = "Thông báo";
    let errorMsg = "Không tìm thấy thông tin địa điểm.";
    if (lang.code !== 'vi') {
      errorTitle = await autoTranslate(errorTitle, lang.code);
      errorMsg = await autoTranslate(errorMsg, lang.code);
    }
    Alert.alert(errorTitle, errorMsg);
  }
};
  const checkGeofencing = async () => {
    const now = Date.now();
    let nearestPoi = null;
    let minDistance = 101;
    for (let poi of pois) {
      const dist = getDistance(userLocation.latitude, userLocation.longitude, poi.latitude, poi.longitude);
      if (dist <= 100 && dist < minDistance) {
        minDistance = dist;
        nearestPoi = poi;
      }
    }
    if (nearestPoi) {
      const poi = nearestPoi;
      const timeSinceLastPlay = now - (lastPlayedTimestamp.current[poi.id] || 0);
      if (timeSinceLastPlay > 30000 || lastPlayedPoiId.current !== poi.id) {
        lastPlayedPoiId.current = poi.id;
        lastPlayedTimestamp.current[poi.id] = now;
        setSelectedPoi(poi);
        let title = "📍 Vào vùng ảnh hưởng";
        if (lang.code !== 'vi') {
          try { title = await autoTranslate(title, lang.code); } catch (e) {}
        }
        const nameStr = typeof poi.name === 'object' ? (poi.name?.vi || poi.name?.en || "") : poi.name;
        Alert.alert(title, `${nameStr}.`);
      }
    }
  };

  const playSpeech = (text) => {
    if (!text || typeof text !== 'string') return;
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, { language: lang.locale, rate: 0.9, onDone: () => setIsSpeaking(false) });
  };

  const handleAutoTranslate = async (targetPoi) => {
    const poiToUse = targetPoi || selectedPoi;
    if (!poiToUse) return;

    // CHUẨN HÓA DỮ LIỆU ĐẦU VÀO (Xử lý cả Object và String)
    const originName = typeof poiToUse.name === 'object' ? (poiToUse.name?.vi || poiToUse.name?.en || "") : (poiToUse.name || "");
    const originDesc = typeof poiToUse.description === 'object' ? (poiToUse.description?.vi || poiToUse.description?.en || "") : (poiToUse.description || "");

    let finalName = originName;
    let finalDesc = originDesc;

    if (lang.code !== 'vi') {
      setIsTranslating(true);
      try {
        // Kiểm tra xem database đã có sẵn bản dịch cho ngôn ngữ này chưa
        if (typeof poiToUse.name === 'object' && poiToUse.name[lang.code]) {
          finalName = poiToUse.name[lang.code];
          finalDesc = poiToUse.description[lang.code];
        } else {
          const [tName, tDesc] = await Promise.all([
            autoTranslate(originName, lang.code),
            autoTranslate(originDesc, lang.code)
          ]);
          finalName = tName;
          finalDesc = tDesc;
        }
      } catch (e) { console.log(e); } finally { setIsTranslating(false); }
    }

    setTranslatedData({ name: finalName, desc: finalDesc });
    
    const dist = getDistance(userLocation.latitude, userLocation.longitude, poiToUse.latitude, poiToUse.longitude);
    if ((dist <= 100 || lastPlayedPoiId.current === poiToUse.id) && lastPlayedPoiId.current === poiToUse.id) {
      playSpeech(finalDesc);
    }
  };

  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (!text) { setFilteredPois(pois); setIsDropdownVisible(false); return; }
    
    const filtered = pois.filter(p => {
      const nameStr = typeof p.name === 'object' ? (p.name?.vi || p.name?.en || "") : (p.name || "");
      return nameStr.toLowerCase().includes(text.toLowerCase());
    });
    
    setFilteredPois(filtered);
    setIsDropdownVisible(true);
  };

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await API.get("/auth/profile", { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.status === "success") {
        setUserData({ name: res.data.data.fullName || "Khách", email: res.data.data.email || "" });
      }
    } catch (e) {
      const n = await AsyncStorage.getItem('userName') || "Khách";
      const em = await AsyncStorage.getItem('userEmail') || "";
      setUserData({name: n, email: em});
    }
  };

  const fetchPois = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const res = await API.get("/pois", { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.data?.items) {
        setPois(res.data.data.items);
        setFilteredPois(res.data.data.items);
      }
    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const handleToggleSpeech = () => {
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); }
    else playSpeech(translatedData.desc);
  };

  const handleLogout = async () => {
    setIsMenuVisible(false);
    const logoutTitle = uiLabels.logout; 
    let logoutMsg = "Bạn có chắc chắn muốn thoát?";
    let cancelBtn = "Hủy";

    if (lang.code !== 'vi') {
      try {
        logoutMsg = await autoTranslate(logoutMsg, lang.code);
        cancelBtn = await autoTranslate(cancelBtn, lang.code);
      } catch (e) { console.log(e); }
    }

    Alert.alert(logoutTitle, logoutMsg, [
      { text: cancelBtn, style: "cancel" },
      { 
        text: logoutTitle, 
        onPress: async () => {
          await Speech.stop();
          await AsyncStorage.clear();
          navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
        } 
      }
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#FF6F00" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.searchSection}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.roundBtn} onPress={() => setIsMenuVisible(true)}>
            <Text style={{fontSize: 20}}>☰</Text>
          </TouchableOpacity>

          <View style={styles.searchBar}>
            <TextInput
              placeholder={uiLabels.searchPlaceholder}
              style={styles.input}
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>
        </View>

        {isDropdownVisible && (
          <View style={styles.dropdown}>
            <FlatList
              data={filteredPois}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const nameStr = typeof item.name === 'object' ? (item.name?.vi || item.name?.en || "Location") : item.name;
                return (
                  <TouchableOpacity style={styles.dropItem} onPress={() => {
                    setSelectedPoi(item);
                    setIsDropdownVisible(false);
                    setSearchQuery("");
                    mapRef.current?.animateToRegion({ latitude: item.latitude, longitude: item.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);
                  }}>
                    <Text style={styles.dropItemText}>{nameStr}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>

      <MapView 
        ref={mapRef} 
        style={styles.map} 
        provider={PROVIDER_GOOGLE}
        onPress={(e) => setUserLocation(e.nativeEvent.coordinate)}
        initialRegion={{ latitude: 10.7712, longitude: 106.6901, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        <Marker coordinate={userLocation} pinColor="blue" />
        {pois.map((p) => (
          <React.Fragment key={p.id}>
            <Circle 
              center={{ latitude: p.latitude, longitude: p.longitude }}
              radius={100}
              strokeColor="rgba(255, 111, 0, 0.5)"
              fillColor="rgba(255, 111, 0, 0.2)"
            />
            <Marker coordinate={{ latitude: p.latitude, longitude: p.longitude }} onPress={() => setSelectedPoi(p)}>
              <View style={[styles.customMarker, selectedPoi?.id === p.id && styles.activeMarker]}>
                <Text style={{fontSize: 14}}>📍</Text>
              </View>
            </Marker>
          </React.Fragment>
        ))}
      </MapView>

      <View style={styles.infoContainer}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{padding: 25}}>
          <View style={styles.badge}><Text style={styles.badgeText}>{selectedPoi?.type || 'DESTINATION'}</Text></View>
          <Text style={styles.poiName}>{translatedData.name}</Text>
          <View style={styles.divider} />
          <Text style={styles.descLabel}>{uiLabels.details}</Text>
          {isTranslating ? <ActivityIndicator size="small" color="#FF6F00" /> : <Text style={styles.poiDesc}>{translatedData.desc}</Text>}
          <TouchableOpacity style={[styles.audioBtn, isSpeaking && styles.audioBtnActive]} onPress={handleToggleSpeech}>
            <Text style={[styles.audioBtnText, isSpeaking && {color: '#fff'}]}>
              {isSpeaking ? uiLabels.stop : uiLabels.listen}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Modal visible={isMenuVisible} animationType="slide" transparent>
        <View style={styles.menuOverlay}>
          <View style={styles.menuSideBar}>
            <View style={styles.menuHeader}>
              <View style={styles.avatarCircle}><Text style={styles.avatarText}>{userData.name.charAt(0)}</Text></View>
              <Text style={styles.menuName}>{userData.name}</Text>
              <Text style={styles.menuEmail}>{userData.email}</Text>
            </View>
            <View style={styles.menuBody}>
              <Text style={styles.menuTitleSection}>{uiLabels.profileTitle}</Text>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuVisible(false); navigation.navigate('Profile', { currentLang: lang }); }}>
                <Text style={styles.menuItemIcon}>👤</Text>
                <Text style={styles.menuItemText}>{uiLabels.profileLink}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuVisible(false); openScanner(); }}>
                <Text style={styles.menuItemIcon}>📷</Text>
                <Text style={styles.menuItemText}>{uiLabels.scanQR}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuVisible(false); setIsLangModalVisible(true); }}>
                <Text style={styles.menuItemIcon}>{lang.flag}</Text>
                <Text style={styles.menuItemText}>{uiLabels.langTitle}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Text style={styles.menuItemIcon}>🚪</Text>
                <Text style={[styles.menuItemText, {color: '#FF3B30'}]}>{uiLabels.logout}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeMenuBtn} onPress={() => setIsMenuVisible(false)}>
                <Text style={{color: '#666'}}>{uiLabels.closeMenu}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={{flex:1}} onPress={() => setIsMenuVisible(false)} />
        </View>
      </Modal>

      <Modal visible={isScannerVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView 
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} 
            style={StyleSheet.absoluteFillObject} 
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          <View style={styles.scannerOverlay}>
            <View style={{width: 220, height: 220, borderWidth: 2, borderColor: '#fff', borderRadius: 20, marginBottom: 40, borderStyle: 'dashed'}} />
            <Text style={styles.scannerText}>Đặt mã QR vào khung hình</Text>
            <TouchableOpacity style={styles.closeScannerBtn} onPress={() => setIsScannerVisible(false)}>
              <Text style={{color: '#fff', fontWeight: 'bold'}}>HỦY BỎ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isLangModalVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setIsLangModalVisible(false)}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{uiLabels.langTitle}</Text>
              <FlatList
                data={LANGUAGES}
                numColumns={2}
                keyExtractor={(i) => i.code}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.langGridItem, lang.code === item.code && styles.langGridItemActive]} 
                    onPress={() => { setLang(item); setIsLangModalVisible(false); Speech.stop(); }}
                  >
                    <Text style={{fontSize: 30}}>{item.flag}</Text>
                    <Text style={styles.langNameText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchSection: { position: 'absolute', top: 50, left: 15, right: 15, zIndex: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 25, height: 50, alignItems: 'center', paddingHorizontal: 20, marginLeft: 10, elevation: 10 },
  input: { flex: 1, fontSize: 14 },
  roundBtn: { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  dropdown: { backgroundColor: '#fff', borderRadius: 15, marginTop: 10, elevation: 10, maxHeight: 200 },
  dropItem: { padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  dropItemText: { fontWeight: '500' },
  map: { width: width, height: height * 0.65 },
  customMarker: { backgroundColor: '#fff', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: '#FF6F00' },
  activeMarker: { backgroundColor: '#FF6F00' },
  infoContainer: { flex: 1, backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -30, elevation: 25 },
  handle: { width: 40, height: 5, backgroundColor: '#EEE', borderRadius: 5, alignSelf: 'center', marginTop: 10 },
  badge: { backgroundColor: '#FFF3E0', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 5 },
  badgeText: { color: '#FF6F00', fontSize: 10, fontWeight: 'bold' },
  poiName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 15 },
  descLabel: { fontSize: 10, color: '#999', marginBottom: 5, fontWeight: 'bold' },
  poiDesc: { fontSize: 15, color: '#555', lineHeight: 22, marginBottom: 20 },
  audioBtn: { backgroundColor: '#FFF3E0', padding: 15, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#FF6F00' },
  audioBtnActive: { backgroundColor: '#FF6F00' },
  audioBtnText: { color: '#FF6F00', fontWeight: 'bold' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  menuSideBar: { width: width * 0.75, backgroundColor: '#fff', height: '100%', elevation: 20 },
  menuHeader: { padding: 40, paddingTop: 60, backgroundColor: '#FFF3E0', alignItems: 'center' },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF6F00', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { color: '#fff', fontSize: 35, fontWeight: 'bold' },
  menuName: { fontSize: 20, fontWeight: 'bold' },
  menuEmail: { color: '#666', fontSize: 12 },
  menuBody: { padding: 20 },
  menuTitleSection: { fontSize: 12, color: '#999', fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  menuItemIcon: { fontSize: 20, marginRight: 15 },
  menuItemText: { fontSize: 16, fontWeight: '500' },
  closeMenuBtn: { marginTop: 30, alignSelf: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 20, width: '85%', maxHeight: '70%' },
  modalTitle: { textAlign: 'center', fontWeight: 'bold', marginBottom: 15, fontSize: 16 },
  langGridItem: { flex: 1, alignItems: 'center', padding: 15, margin: 5, borderRadius: 15, borderWidth: 1, borderColor: '#EEE' },
  langGridItemActive: { backgroundColor: '#FFF3E0', borderColor: '#FF6F00' },
  langNameText: { fontSize: 12, marginTop: 5, fontWeight: '500' },
  scannerOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50 },
  scannerText: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 10, marginBottom: 20 },
  closeScannerBtn: { backgroundColor: '#FF6F00', padding: 15, borderRadius: 25, width: 150, alignItems: 'center' },
});
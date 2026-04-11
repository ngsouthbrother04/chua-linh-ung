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

const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', locale: 'vi-VN' },
  { code: 'en', name: 'English', flag: '🇺🇸', locale: 'en-US' },
  { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭', locale: 'th-TH' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', locale: 'ja-JP' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', locale: 'ko-KR' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', locale: 'fr-FR' },
];

export default function HomeScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [pois, setPois] = useState([]);
  const poisRef = useRef([]); 
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
    searchPlaceholder: "Tìm kiếm địa điểm...", profileTitle: "Trang cá nhân", profileLink: "Hồ sơ cá nhân",
    scanQR: "Quét QR", logout: "Đăng xuất", details: "THÔNG TIN CHI TIẾT",
    listen: "🔊 NGHE THUYẾT MINH", stop: "⏹ DỪNG PHÁT", closeMenu: "Đóng menu", langTitle: "Chọn Ngôn Ngữ"
  });

  const [userData, setUserData] = useState({ name: "Người dùng", email: "" });
  const mapRef = useRef(null);
  const lastPlayedPoiId = useRef(null); 

  useEffect(() => {
    fetchPois();
    loadUserData();
    const unsubscribe = navigation.addListener('focus', loadUserData);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (pois.length > 0) checkGeofencing();
  }, [userLocation, pois]);

  useEffect(() => {
    const translateUI = async () => {
      if (lang.code === 'vi') {
        setUiLabels({
          searchPlaceholder: "Tìm kiếm địa điểm...", profileTitle: "Trang cá nhân", profileLink: "Hồ sơ cá nhân",
          scanQR: "Quét QR", logout: "Đăng xuất", details: "THÔNG TIN CHI TIẾT",
          listen: "🔊 NGHE THUYẾT MINH", stop: "⏹ DỪNG PHÁT", closeMenu: "Đóng menu", langTitle: "Chọn Ngôn Ngữ"
        });
        navigation.setOptions({ title: "🏠 Trang chủ" });
      } else {
        try {
          const keys = Object.keys(uiLabels);
          const translatedValues = await Promise.all(
            Object.values(uiLabels).map(val => autoTranslate(val.replace(/🔊 |⏹ /g, ""), lang.code))
          );
          const newLabels = {};
          keys.forEach((key, i) => {
            let prefix = key === "listen" ? "🔊 " : (key === "stop" ? "⏹ " : "");
            newLabels[key] = prefix + translatedValues[i];
          });
          setUiLabels(newLabels);
          const translatedHome = await autoTranslate("Trang chủ", lang.code);
          navigation.setOptions({ title: `🏠 ${translatedHome}` });
        } catch (e) { console.log(e); }
      }
    };
    translateUI();
  }, [lang]);

  // Quan trọng: Chỉ dịch, KHÔNG tự phát ở đây để tránh lỗi đổi ngôn ngữ bị phát lại
  useEffect(() => {
    if (selectedPoi) handleAutoTranslate(selectedPoi, false);
  }, [selectedPoi, lang]);

  const playSpeech = (text) => {
    if (!text || typeof text !== 'string') return;
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, { language: lang.locale, rate: 0.9, onDone: () => setIsSpeaking(false) });
  };

  const handleAutoTranslate = async (poi, shouldPlay = false) => {
    if (!poi) return;
    const originName = typeof poi.name === 'object' ? (poi.name?.vi || poi.name?.en || "") : (poi.name || "");
    const originDesc = typeof poi.description === 'object' ? (poi.description?.vi || poi.description?.en || "") : (poi.description || "");

    let finalName = originName;
    let finalDesc = originDesc;

    if (lang.code !== 'vi') {
      setIsTranslating(true);
      try {
        if (typeof poi.name === 'object' && poi.name[lang.code]) {
          finalName = poi.name[lang.code];
          finalDesc = poi.description[lang.code];
        } else {
          const [tName, tDesc] = await Promise.all([
            autoTranslate(originName, lang.code), autoTranslate(originDesc, lang.code)
          ]);
          finalName = tName; finalDesc = tDesc;
        }
      } catch (e) { console.log(e); } finally { setIsTranslating(false); }
    }

    setTranslatedData({ name: finalName, desc: finalDesc });
    if (shouldPlay) playSpeech(finalDesc);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setIsScannerVisible(false);
    const foundPoi = poisRef.current.find(p => p.id.toString() === data.trim());
    if (foundPoi) {
      lastPlayedPoiId.current = foundPoi.id;
      setSelectedPoi(foundPoi);
      handleAutoTranslate(foundPoi, true); // PHÁT LUÔN
      mapRef.current?.animateToRegion({
        latitude: parseFloat(foundPoi.latitude), longitude: parseFloat(foundPoi.longitude),
        latitudeDelta: 0.005, longitudeDelta: 0.005
      }, 1000);
    }
  };

  const checkGeofencing = async () => {
    const currentPois = poisRef.current;
    if (currentPois.length === 0) return;
    let nearestPoi = null;
    let minDistance = 101; 

    for (let poi of currentPois) {
      const dist = getDistance(
        parseFloat(userLocation.latitude), parseFloat(userLocation.longitude), 
        parseFloat(poi.latitude), parseFloat(poi.longitude)
      );
      if (dist <= 100 && dist < minDistance) {
        minDistance = dist;
        nearestPoi = poi;
      }
    }

    if (nearestPoi) {
      if (lastPlayedPoiId.current !== nearestPoi.id) {
        lastPlayedPoiId.current = nearestPoi.id;
        setSelectedPoi(nearestPoi);
        handleAutoTranslate(nearestPoi, true); // PHÁT LUÔN

        let title = "📍 Vào vùng ảnh hưởng";
        if (lang.code !== 'vi') { try { title = await autoTranslate(title, lang.code); } catch (e) {} }
        const nameStr = typeof nearestPoi.name === 'object' ? (nearestPoi.name?.vi || nearestPoi.name?.en || "") : nearestPoi.name;
        Alert.alert(title, nameStr);
      }
    } else {
      lastPlayedPoiId.current = null;
    }
  };

  const fetchPois = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const res = await API.get("/pois", { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.data?.items) {
        const items = res.data.data.items;
        setPois(items);
        poisRef.current = items;
        setFilteredPois(items);
      }
    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

const loadUserData = async () => {
    try {
      // BƯỚC 1: Lấy ngay từ bộ nhớ máy để hiện lên liền, không bắt user chờ API
      const localName = await AsyncStorage.getItem('userName');
      const localEmail = await AsyncStorage.getItem('userEmail');
      
      if (localName) {
        setUserData({ 
          name: localName, 
          email: localEmail || "" 
        });
      }

      // BƯỚC 2: Gọi API chạy ngầm để cập nhật dữ liệu mới nhất (nếu có thay đổi)
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const res = await API.get("/users/profile", { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      if (res.data?.status === "success") {
        const { fullName, email } = res.data.data;
        
        // Cập nhật lại State nếu dữ liệu API khác dữ liệu Local
        setUserData({ 
          name: fullName || localName || "Người dùng", 
          email: email || localEmail || "" 
        });

        // Cập nhật ngược lại Local để lần sau mở App là có dữ liệu mới nhất
        await AsyncStorage.setItem('userName', fullName || "");
        await AsyncStorage.setItem('userEmail', email || "");
      }
    } catch (e) {
      console.log("Lỗi tải profile:", e);
      // Nếu API lỗi thì vẫn giữ dữ liệu đã lấy từ Local ở Bước 1, không làm gì thêm
    }
  };

  const handleToggleSpeech = () => {
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); }
    else playSpeech(translatedData.desc);
  };

  const handleLogout = async () => {
    setIsMenuVisible(false);
    Alert.alert(uiLabels.logout, "Thoát ứng dụng?", [
      { text: "Hủy", style: "cancel" },
      { text: uiLabels.logout, onPress: async () => {
          await Speech.stop(); await AsyncStorage.clear();
          navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      }}
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
              placeholder={uiLabels.searchPlaceholder} style={styles.input}
              value={searchQuery} onChangeText={(text) => {
                setSearchQuery(text);
                if (!text) { setFilteredPois(pois); setIsDropdownVisible(false); return; }
                const filtered = pois.filter(p => {
                  const nameStr = typeof p.name === 'object' ? (p.name?.vi || p.name?.en || "") : (p.name || "");
                  return nameStr.toLowerCase().includes(text.toLowerCase());
                });
                setFilteredPois(filtered); setIsDropdownVisible(true);
              }}
            />
          </View>
        </View>
        {isDropdownVisible && (
          <View style={styles.dropdown}>
            <FlatList
              data={filteredPois} keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.dropItem} onPress={() => {
                  setSelectedPoi(item); setIsDropdownVisible(false); setSearchQuery("");
                  mapRef.current?.animateToRegion({ latitude: parseFloat(item.latitude), longitude: parseFloat(item.longitude), latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);
                }}>
                  <Text style={styles.dropItemText}>{typeof item.name === 'object' ? (item.name?.vi || item.name?.en) : item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      <MapView 
        ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE}
        onPress={(e) => setUserLocation(e.nativeEvent.coordinate)}
        initialRegion={{ latitude: 10.7712, longitude: 106.6901, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {userLocation && <Marker coordinate={userLocation} pinColor="blue" title="Bạn ở đây" />}
        {pois.map((p) => (
          <React.Fragment key={p.id}>
            <Circle center={{ latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude) }} radius={100} strokeColor="rgba(255, 111, 0, 0.5)" fillColor="rgba(255, 111, 0, 0.2)" />
            <Marker coordinate={{ latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude) }} onPress={() => {
                const dist = getDistance(parseFloat(userLocation.latitude), parseFloat(userLocation.longitude), parseFloat(p.latitude), parseFloat(p.longitude));
                if (dist <= 100) {
                    lastPlayedPoiId.current = p.id;
                    setSelectedPoi(p);
                    handleAutoTranslate(p, true); // CHẠM TRONG VÙNG: PHÁT LUÔN
                } else {
                    setSelectedPoi(p);
                }
            }}>
              <View style={[styles.customMarker, selectedPoi?.id === p.id && styles.activeMarker]}><Text>📍</Text></View>
            </Marker>
          </React.Fragment>
        ))}
      </MapView>

      <View style={styles.infoContainer}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{padding: 25}}>
          <View style={styles.badge}><Text style={styles.badgeText}>{selectedPoi?.type || 'POI'}</Text></View>
          <Text style={styles.poiName}>{translatedData.name}</Text>
          <View style={styles.divider} />
          <Text style={styles.descLabel}>{uiLabels.details}</Text>
          {isTranslating ? <ActivityIndicator size="small" color="#FF6F00" /> : <Text style={styles.poiDesc}>{translatedData.desc}</Text>}
          <TouchableOpacity style={[styles.audioBtn, isSpeaking && styles.audioBtnActive]} onPress={handleToggleSpeech}>
            <Text style={[styles.audioBtnText, isSpeaking && {color: '#fff'}]}>{isSpeaking ? uiLabels.stop : uiLabels.listen}</Text>
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
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuVisible(false); navigation.navigate('Profile', { currentLang: lang }); }}>
                <Text style={styles.menuItemIcon}>👤</Text><Text style={styles.menuItemText}>{uiLabels.profileLink}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuVisible(false); 
                if (!permission?.granted) requestPermission(); else setIsScannerVisible(true); setScanned(false);
              }}>
                <Text style={styles.menuItemIcon}>📷</Text><Text style={styles.menuItemText}>{uiLabels.scanQR}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuVisible(false); setIsLangModalVisible(true); }}>
                <Text style={styles.menuItemIcon}>{lang.flag}</Text><Text style={styles.menuItemText}>{uiLabels.langTitle}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Text style={styles.menuItemIcon}>🚪</Text><Text style={[styles.menuItemText, {color: '#FF3B30'}]}>{uiLabels.logout}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeMenuBtn} onPress={() => setIsMenuVisible(false)}><Text>Đóng</Text></TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={{flex:1}} onPress={() => setIsMenuVisible(false)} />
        </View>
      </Modal>

      <Modal visible={isScannerVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} style={StyleSheet.absoluteFillObject} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} />
          <View style={styles.scannerOverlay}>
            <View style={{width: 220, height: 220, borderWidth: 2, borderColor: '#fff', borderRadius: 20, marginBottom: 40, borderStyle: 'dashed'}} />
            <TouchableOpacity style={styles.closeScannerBtn} onPress={() => setIsScannerVisible(false)}><Text style={{color: '#fff'}}>HỦY BỎ</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isLangModalVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setIsLangModalVisible(false)}>
          <TouchableWithoutFeedback><View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{uiLabels.langTitle}</Text>
              <FlatList data={LANGUAGES} numColumns={2} keyExtractor={(i) => i.code} renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.langGridItem, lang.code === item.code && styles.langGridItemActive]} 
                    onPress={() => { setLang(item); setIsLangModalVisible(false); Speech.stop(); }}>
                    <Text style={{fontSize: 30}}>{item.flag}</Text><Text style={styles.langNameText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              /></View>
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
  customMarker: { backgroundColor: '#fff', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: '#FF6F00', justifyContent: 'center', alignItems: 'center' },
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
  scannerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  closeScannerBtn: { backgroundColor: '#FF6F00', padding: 15, borderRadius: 25, width: 150, alignItems: 'center', marginTop: 20 },
});
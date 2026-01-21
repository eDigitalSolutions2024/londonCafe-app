import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import PhoneBoothIcon from "./src/assets/icons/phone-booth.svg";
import AccountSettingsScreen from "./src/screens/AccountSettingsScreen";

import HomeScreen from "./src/screens/HomeScreen";
import LocationScreen from "./src/screens/LocationScreen";

// Tabs
import OrderScreen from "./src/screens/OrderScreen";
import ScanScreen from "./src/screens/ScanScreen";
import GiftsScreen from "./src/screens/GiftsScreen";

// Pantallas internas del tab Inicio
import AvatarCustomizeScreen from "./src/screens/AvatarCustomizeScreen";

// Auth
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import VerifyEmailScreen from "./src/screens/VerifyEmailScreen";

import { colors } from "./src/theme/colors";
import { AuthProvider, AuthContext } from "./src/context/AuthContext";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();

/** ✅ Stack SOLO para el tab "Inicio"
 *  (así se mantiene el tab bar abajo)
 */
function HomeStackNav() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="AvatarCustomize" component={AvatarCustomizeScreen} />
      <HomeStack.Screen name="AccountSettings" component={AccountSettingsScreen} /> 
    </HomeStack.Navigator>
  );
}


function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#111118",
          borderTopColor: "#222230",
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size, focused }) => {
          // ✅ SVG solo para Inicio
          if (route.name === "Inicio") {
            return (
              <PhoneBoothIcon
                width={size}
                height={size}
                stroke={color}
                fill="none"
                opacity={focused ? 1 : 0.6}
              />
            );
          }

          // Ionicons para los demás
          let iconName = "home";
          if (route.name === "Ordena") iconName = "cart";
          if (route.name === "Escanear") iconName = "scan";
          if (route.name === "Regalos") iconName = "gift";
          if (route.name === "Ubicación") iconName = "location";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* ✅ Inicio ahora es un Stack (para que AvatarCustomize no quite el tab bar) */}
      <Tab.Screen name="Inicio" component={HomeStackNav} />

      <Tab.Screen name="Ordena" component={OrderScreen} />
      <Tab.Screen name="Escanear" component={ScanScreen} />
      <Tab.Screen name="Regalos" component={GiftsScreen} />
      <Tab.Screen name="Ubicación" component={LocationScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
    </Stack.Navigator>
  );
}

function RootNav() {
  const { token, loading } = useContext(AuthContext);
  if (loading) return null;

  // ✅ Ya no ocupamos AppStack arriba de Tabs
  // porque AvatarCustomize vive dentro del HomeStackNav
  return token ? <MainTabs /> : <AuthStack />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNav />
      </NavigationContainer>
    </AuthProvider>
  );
}

import React, { useContext } from "react";
import { View } from "react-native";
import { NavigationContainer, CommonActions } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import PhoneBoothIcon from "./src/assets/icons/phone-booth.svg";
import { SafeAreaProvider } from "react-native-safe-area-context";

// ✅ Stripe
import { StripeProvider } from "@stripe/stripe-react-native";

import HomeScreen from "./src/screens/HomeScreen";
import LocationScreen from "./src/screens/LocationScreen";

// Tabs
import OrderScreen from "./src/screens/OrderScreen";
import CartScreen from "./src/screens/CartScreen";
import { CartProvider } from "./src/context/CartContext.js";
import ScanScreen from "./src/screens/ScanScreen";
import GiftsScreen from "./src/screens/GiftsScreen";

// Pantallas internas del tab Inicio
import AvatarCustomizeScreen from "./src/screens/AvatarCustomizeScreen";
import AccountSettingsScreen from "./src/screens/AccountSettingsScreen";
import AvatarPreviewLargeScreen from "./src/screens/AvatarPreviewLargeScreen";

// Auth
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import VerifyEmailScreen from "./src/screens/VerifyEmailScreen";

import RewardsScreen from "./src/screens/RewardsScreen";
import WalletHistoryScreen from "./src/screens/WalletHistoryScreen";
import RedeemQRScreen from "./src/screens/RedeemQRScreen";

import PedidosScreen from "./src/screens/PedidosScreen";

import { colors } from "./src/theme/colors";
import { AuthProvider, AuthContext } from "./src/context/AuthContext";

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const AuthNav = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const OrderStack = createNativeStackNavigator();

// Modal auth stack — Login / Register / VerifyEmail
function AuthStack() {
  return (
    <AuthNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthNav.Screen name="Login" component={LoginScreen} />
      <AuthNav.Screen name="Register" component={RegisterScreen} />
      <AuthNav.Screen name="VerifyEmail" component={VerifyEmailScreen} />
    </AuthNav.Navigator>
  );
}

function HomeStackNav() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Rewards" component={RewardsScreen} />
      <HomeStack.Screen name="WalletHistory" component={WalletHistoryScreen} />
      <HomeStack.Screen name="AvatarCustomize" component={AvatarCustomizeScreen} />
      <HomeStack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <HomeStack.Screen name="RedeemQR" component={RedeemQRScreen} />
      <HomeStack.Screen name="AvatarPreviewLarge" component={AvatarPreviewLargeScreen} />
    </HomeStack.Navigator>
  );
}

function OrderStackNav() {
  return (
    <OrderStack.Navigator screenOptions={{ headerShown: false }}>
      <OrderStack.Screen name="Order" component={OrderScreen} />
      <OrderStack.Screen name="Cart" component={CartScreen} />
      <OrderStack.Screen name="Pedidos" component={PedidosScreen} />
    </OrderStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "#111118",
          borderTopColor: "#222230",
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size, focused }) => {
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

          let iconName = "home";
          if (route.name === "Ordena") iconName = "cart";
          if (route.name === "Escanear") iconName = "scan";
          if (route.name === "Regalos") iconName = "gift";
          if (route.name === "Ubicación") iconName = "location";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Inicio"
        component={HomeStackNav}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            const tabState = navigation.getState().routes.find((r) => r.name === "Inicio")?.state;
            // Si hay pantallas apiladas (Rewards, WalletHistory, etc.) sobre
            // Home, cada tap en "Inicio" debe regresar a la pantalla
            // principal -- no quedarse donde el usuario dejó ese stack la
            // última vez, que es el comportamiento por defecto de React
            // Navigation al cambiar de tab y volver.
            if (tabState && tabState.index > 0) {
              navigation.dispatch({
                ...CommonActions.reset({
                  index: 0,
                  routes: [{ name: "Home" }],
                }),
                target: tabState.key,
              });
            }
          },
        })}
      />
      <Tab.Screen name="Ordena" component={OrderStackNav} />
      <Tab.Screen name="Escanear" component={ScanScreen} />
      <Tab.Screen name="Regalos" component={GiftsScreen} />
      <Tab.Screen name="Ubicación" component={LocationScreen} />
    </Tab.Navigator>
  );
}

// Root: always renders tabs; auth is a modal on top
function RootNav() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen
        name="AuthModal"
        component={AuthStack}
        options={{ presentation: "modal" }}
      />
    </RootStack.Navigator>
  );
}

// Handles loading splash before mounting NavigationContainer
function AppContent() {
  const { loading } = useContext(AuthContext);

  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.background }} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNav />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  console.log("STRIPE KEY:", process.env.EXPO_PUBLIC_STRIPE_PK);
  const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PK;

  if (!STRIPE_PK) {
    throw new Error("Stripe publishable key missing. Set EXPO_PUBLIC_STRIPE_PK.");
  }

  return (
    <StripeProvider
      publishableKey={STRIPE_PK}
      merchantIdentifier="merchant.com.londoncafejrz"
    >
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </StripeProvider>
  );
}

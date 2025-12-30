import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './src/screens/HomeScreen';
import MenuScreen from './src/screens/MenuScreen';
import PromotionsScreen from './src/screens/PromotionsScreen';
import LocationScreen from './src/screens/LocationScreen';
import { colors } from './src/theme/colors';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#111118',
            borderTopColor: '#222230',
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ color, size }) => {
            let iconName = 'cafe';

            if (route.name === 'Inicio') iconName = 'home';
            if (route.name === 'Menu') iconName = 'cafe';
            if (route.name === 'Promos') iconName = 'pricetag';
            if (route.name === 'Ubicación') iconName = 'location';

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Inicio" component={HomeScreen} />
        <Tab.Screen name="Menu" component={MenuScreen} />
        <Tab.Screen name="Promos" component={PromotionsScreen} />
        <Tab.Screen name="Ubicación" component={LocationScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

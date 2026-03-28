import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import MisTareasScreen from '../screens/MisTareasScreen';
import ChatScreen from '../screens/ChatScreen';
import PerfilScreen from '../screens/PerfilScreen';
import AdminDashboard from '../screens/admin/AdminDashboard';
import UserDashboard from '../screens/user/UserDashboard';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function UserTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Mis Tareas" component={MisTareasScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, perfil, loading } = useAuth();

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session || !perfil ? ( // Si no hay sesión O no cargó el perfil, al Login
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : perfil.rol === 'Administrador' ? (
          <Stack.Screen name="Admin" component={AdminDashboard} />
        ) : (
          <Stack.Screen name="User" component={UserDashboard} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
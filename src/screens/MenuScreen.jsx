import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { getMenu } from '../api/client';
import Screen from '../components/Screen';


export default function MenuScreen() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMenu()
      .then(data => setMenu(data))
      .catch(err => {
        console.log(err);
        setError('No se pudo cargar el menú');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator />
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>Cargando menú...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: 'red' }]}>{error}</Text>
      </View>
    );
  }

  return (
    <Screen>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Menú LondonCafe</Text>

        {menu.map(category => (
          <View key={category.id} style={styles.categoryBlock}>
            <Text style={styles.categoryTitle}>{category.name}</Text>

            {category.items.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>${item.price}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  categoryBlock: {
    marginBottom: 20,
  },
  categoryTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    color: colors.text,
    fontSize: 14,
  },
  itemPrice: {
    color: colors.textMuted,
    fontSize: 14,
  },
});

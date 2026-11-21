import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from 'react-native-paper';
import Container from '@/Components/Container/Container';
import policy from '@/Utils/privacyPolicyContent';

// The Privacy Policy, readable inside the app (and offline). The text comes
// from privacyPolicyContent.js, a copy of the policy published on the website.
const PrivacyPolicyScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();

  return (
    <Container style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Back">
          <Image
            source={require('@/Assets/Common/Back.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{policy.title}</Text>
        <Text style={styles.updated}>Last updated: {policy.updated}</Text>

        {policy.sections.map(section => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.blocks.map((block, index) => {
              const indent = { marginLeft: (block.indent || 0) * 16 };
              return block.type === 'li' ? (
                <View key={index} style={[styles.item, indent]}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={[styles.text, styles.itemText]}>
                    {block.text}
                  </Text>
                </View>
              ) : (
                <Text key={index} style={[styles.text, styles.para, indent]}>
                  {block.text}
                </Text>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </Container>
  );
};

export default PrivacyPolicyScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 10 },
    header: { height: 52, justifyContent: 'center', alignItems: 'center' },
    backButton: {
      position: 'absolute',
      left: 0,
      width: 52,
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
    },
    backIcon: { width: 23, height: 23 },
    headerTitle: {
      fontSize: 16,
      fontFamily: 'Poppins Medium',
      color: colors.text,
    },
    content: { paddingHorizontal: 16, paddingBottom: 40 },
    title: {
      fontSize: 18,
      lineHeight: 26,
      fontFamily: 'Poppins Medium',
      color: colors.text,
      marginTop: 8,
    },
    updated: {
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: colors.onSurfaceGrey || '#888',
      marginTop: 4,
      marginBottom: 8,
    },
    section: { marginTop: 18 },
    heading: {
      fontSize: 15,
      fontFamily: 'Poppins Medium',
      color: colors.text,
      marginBottom: 6,
    },
    text: {
      fontSize: 13,
      lineHeight: 20,
      fontFamily: 'Poppins Regular',
      color: colors.text,
    },
    para: { marginBottom: 8 },
    item: { flexDirection: 'row', marginBottom: 6 },
    bullet: {
      width: 14,
      fontSize: 13,
      lineHeight: 20,
      color: colors.text,
    },
    itemText: { flex: 1 },
  });

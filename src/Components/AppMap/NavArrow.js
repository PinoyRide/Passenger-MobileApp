import React from 'react';
import { StyleSheet, View } from 'react-native';

// Vehicle marker for the live map: a round puck with a pointed nose and a
// navigation arrow, drawn pointing "up". The parent <Marker> turns it to the
// vehicle's heading (flat + rotation), so it shows the direction of travel.
//
// The shape has to read as a direction at any angle. (A plain triangle in a
// circle does not: when it is nearly equilateral, on a diagonal road you
// cannot tell which corner is the tip and the vehicle looks like it is going
// sideways or backwards.) Hence the nose on the puck and the notched arrow.
//
// The view is square and the puck is at its centre, so a marker anchored at
// (0.5, 0.5) sits exactly on the vehicle's position.

// A triangle pointing up, made from borders.
const triangle = (halfBase, height, color) => ({
  width: 0,
  height: 0,
  borderLeftWidth: halfBase,
  borderRightWidth: halfBase,
  borderBottomWidth: height,
  borderLeftColor: 'transparent',
  borderRightColor: 'transparent',
  borderBottomColor: color,
});

const NavArrow = ({ color = '#FFC107', size = 30 }) => {
  const pad = Math.round(size * 0.36); // room around the puck for the nose
  const box = size + pad * 2;
  const centre = box / 2;
  const halo = size + 10;

  // Nose: starts a little inside the puck so the two join into one shape.
  const noseHalf = Math.round(size * 0.24);
  const noseHeight = Math.round(size * 0.34);
  const noseTop = pad + Math.round(size * 0.1) - noseHeight;
  const outline = 3; // white edge around the nose, to match the puck's border

  // Arrow: tall and narrow, with a notch cut into its base.
  const arrowHalf = Math.round(size * 0.2);
  const arrowHeight = Math.round(size * 0.46);
  const arrowTop = pad + Math.round(size * 0.2);
  const notchHeight = Math.round(size * 0.15);

  return (
    <View style={{ width: box, height: box }}>
      <View
        style={[
          styles.abs,
          styles.halo,
          {
            left: centre - halo / 2,
            top: centre - halo / 2,
            width: halo,
            height: halo,
            borderRadius: halo / 2,
          },
        ]}
      />
      <View
        style={[
          styles.abs,
          triangle(noseHalf + outline, noseHeight + outline + 2, '#FFFFFF'),
          { left: centre - noseHalf - outline, top: noseTop - outline - 1 },
        ]}
      />
      <View
        style={[
          styles.abs,
          styles.puck,
          {
            left: pad,
            top: pad,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.abs,
          triangle(noseHalf, noseHeight, color),
          { left: centre - noseHalf, top: noseTop },
        ]}
      />
      <View
        style={[
          styles.abs,
          triangle(arrowHalf, arrowHeight, '#FFFFFF'),
          { left: centre - arrowHalf, top: arrowTop },
        ]}
      />
      <View
        style={[
          styles.abs,
          triangle(arrowHalf, notchHeight, color),
          {
            left: centre - arrowHalf,
            top: arrowTop + arrowHeight - notchHeight,
          },
        ]}
      />
    </View>
  );
};

export default NavArrow;

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  halo: { backgroundColor: 'rgba(255, 193, 7, 0.25)' },
  puck: { borderWidth: 2, borderColor: '#FFFFFF' },
});

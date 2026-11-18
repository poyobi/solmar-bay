// Solmar Bay — configuration.
// Every tuning number lives here so the rest of the game reads as rules,
// not magic numbers: world size, the road grid, district bounds, landmark
// positions, the weapon table and the fourteen-car catalogue with top
// speed, acceleration, grip, hit points and factory colours per model.

export const WORLD = {
  w: 4800, h: 3600, tile: 64
}
;
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-bay-save-v1';
export const VIEW = {
  w: 1280, h: 720
}
;
export const ROADS = {
  // vertical avenues (x centres) and horizontal streets (y centres)
  vx: [320, 960, 1600, 2240, 2880, 3520, 4160],   hy: [300, 780, 1260, 1740, 2220, 2700, 3180],   vw: 132, hw: 116, sidewalk: 26,
}
;
export const DISTRICTS = [   {
  name: 'Downtown', x: 1400, y: 900, w: 1800, h: 1400
}
,   {
  name: 'Solmar Beach', x: 4160, y: 0, w: 640, h: 3600
}
,   {
  name: 'Portside Docks', x: 0, y: 2700, w: 4160, h: 900
}
,   {
  name: 'North Hills', x: 0, y: 0, w: 4160, h: 780
}
, ];
export const LANDMARKS = [   {
  id: 'safehouse', name: 'Marina Safehouse', x: 3920, y: 1560, color: '#ffd166'
}
,   {
  id: 'garage', name: 'Bay City Customs', x: 1180, y: 820, color: '#8ecae6'
}
,   {
  id: 'gunshop', name: 'Iron Rose Arms', x: 2380, y: 2020, color: '#ef476f'
}
,   {
  id: 'hospital', name: 'St. Alba Hospital', x: 700, y: 2380, color: '#f1fa8c'
}
,   {
  id: 'police', name: 'Solmar PD Central', x: 2560, y: 1180, color: '#6ea8fe'
}
, ];
export const WEAPONS = [   {
  id: 'fists', name: 'Fists', dmg: 14, rate: 0.32, range: 46, spread: 0, ammo: Infinity, mag: Infinity, reload: 0, auto: false,     speed: 0
}
,   {
  id: 'pistol', name: 'Pistol', dmg: 22, rate: 0.26, range: 520, spread: 0.02, ammo: 60, mag: 12, reload: 0.9, auto: false,     speed: 900
}
,   {
  id: 'smg', name: 'SMG', dmg: 13, rate: 0.09, range: 460, spread: 0.07, ammo: 160, mag: 30, reload: 1.2, auto: true, speed: 980
}
, ];
export const CAR_TYPES = [   {
  name: 'Civic Hatch', w: 74, h: 36, top: 300, accel: 260, grip: 3.4, hp: 90, colors: ['#c0c6ce', '#7fb069', '#e0a458', '#5e60ce']
}
,   {
  name: 'Taxi Cab', w: 80, h: 38, top: 320, accel: 280, grip: 3.2, hp: 110, colors: ['#ffd60a', '#ffb703']
}
,   {
  name: 'Family Sedan', w: 80, h: 38, top: 330, accel: 270, grip: 3.3, hp: 100, colors: ['#8d99ae', '#edf2f4', '#2b2d42']
}
,   {
  name: 'Pickup', w: 86, h: 40, top: 300, accel: 250, grip: 3.0, hp: 140, colors: ['#bc6c25', '#606c38', '#283618']
}
,   {
  name: 'Delivery Van', w: 92, h: 42, top: 280, accel: 230, grip: 2.8, hp: 150, colors: ['#ffffff', '#a8dadc', '#f4a261']
}
,   {
  name: 'Muscle Coupe', w: 82, h: 38, top: 430, accel: 380, grip: 3.1, hp: 120, colors: ['#d90429', '#ff7b00', '#3a0ca3']
}
,   {
  name: 'Roadster', w: 78, h: 36, top: 480, accel: 430, grip: 3.6, hp: 100, colors: ['#ff006e', '#8338ec', '#00f5d4']
}
,   {
  name: 'Luxury GT', w: 84, h: 38, top: 460, accel: 400, grip: 3.5, hp: 115, colors: ['#14213d', '#e5e5e5', '#fca311']
}
,   {
  name: 'Lowrider', w: 82, h: 40, top: 310, accel: 260, grip: 2.9, hp: 110, colors: ['#9d4edd', '#06d6a0', '#ef476f']
}
,   {
  name: 'Beach Buggy', w: 72, h: 36, top: 340, accel: 320, grip: 3.8, hp: 90, colors: ['#ffb703', '#fb8500', '#219ebc']
}
,   {
  name: 'Police Interceptor', w: 82, h: 38, top: 450, accel: 390, grip: 3.5, hp: 160, colors: ['#1b263b']
}
,   {
  name: 'Gang Wagon', w: 88, h: 42, top: 360, accel: 300, grip: 3.0, hp: 150, colors: ['#370617', '#6a040f']
}
,   {
  name: 'Armoured Truck', w: 96, h: 44, top: 290, accel: 220, grip: 2.7, hp: 220, colors: ['#495057', '#343a40']
}
,   {
  name: 'Street Racer', w: 80, h: 36, top: 520, accel: 470, grip: 3.7, hp: 105, colors: ['#00bbf9', '#f15bb5', '#fee440']
}
, ];
export const PED_COLORS = ['#e5989b', '#b5838d', '#6d6875', '#ffb4a2', '#ffcdb2', '#84a98c', '#90e0ef', '#f9c74f'];
export const BUILDING_COLORS = ['#5a6c7d', '#6e7f8d', '#7d8597', '#4a5759', '#6b705c', '#8a7d6b', '#546a7b', '#76736e'];
export const ROOF_COLORS = ['#3d405b', '#4a4e69', '#594f43', '#355070', '#6d597a', '#515a4f'];
export const WANTED = {
  decay: 14, garageCost: 150
}
;
export const PLAYER_TUNE = {
  speed: 215, sprint: 330, radius: 13, hp: 100, armour: 100
}
;

// URL del API Gateway. En el celular NO uses "localhost": usa la IP de tu PC.
// Se configura en mobile/.env  ->  EXPO_PUBLIC_API_URL=http://TU_IP:8080
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:8080';

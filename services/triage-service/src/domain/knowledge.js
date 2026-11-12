// ===== BASE DE CONOCIMIENTO DEL RAG =====
// Cada documento describe cuándo acudir a una especialidad.
// Puedes agregar más (síntomas, FAQs de la clínica, horarios, etc.).
export const SPECIALTIES = [
  'Medicina General', 'Cardiología', 'Pediatría', 'Dermatología', 'Gastroenterología', 'Ginecología',
  'Traumatología', 'Neumología', 'Neurología', 'Oftalmología', 'Otorrinolaringología', 'Psicología',
];

export const KNOWLEDGE = [
  { specialty: 'Medicina General', title: 'Malestar general', content: 'Gripa, resfriado, fiebre leve, dolor de cuerpo, cansancio, chequeo general, presión arterial, azúcar, diabetes control, infección leve, malestar general, primera consulta cuando no sabes a qué especialista ir.' },
  { specialty: 'Medicina General', title: 'Infecciones comunes', content: 'Infección urinaria, ardor al orinar, dolor de garganta leve, tos leve, diarrea leve, vacunas, certificados médicos, revisión de análisis de laboratorio.' },
  { specialty: 'Cardiología', title: 'Corazón y circulación', content: 'Palpitaciones, corazón acelerado, arritmia, presión alta que no se controla, hipertensión, colesterol alto, piernas hinchadas, cansancio al caminar o subir escaleras, antecedentes de infarto, soplo en el corazón.' },
  { specialty: 'Pediatría', title: 'Niños y bebés', content: 'Consulta de niño, bebé, hijo, hija, recién nacido, vacunas infantiles, control de crecimiento y desarrollo, fiebre en niños, tos en niños, diarrea en niños, alimentación infantil, adolescentes.' },
  { specialty: 'Dermatología', title: 'Piel, cabello y uñas', content: 'Manchas en la piel, granos, acné, comezón, ronchas, alergia en la piel, lunares que cambian, caída de cabello, caspa, hongos en uñas o pies, verrugas, eccema, psoriasis, quemadura de sol.' },
  { specialty: 'Gastroenterología', title: 'Estómago e intestino', content: 'Dolor de estómago, gastritis, agruras, reflujo, colitis, inflamación abdominal, estreñimiento, diarrea frecuente, náuseas, vómito, hígado, hemorroides, digestión lenta, úlcera.' },
  { specialty: 'Ginecología', title: 'Salud de la mujer', content: 'Menstruación irregular, cólicos menstruales fuertes, embarazo, control prenatal, anticonceptivos, papanicolaou, flujo vaginal, menopausia, revisión de mamas, quistes en ovarios.' },
  { specialty: 'Traumatología', title: 'Huesos, músculos y articulaciones', content: 'Dolor de rodilla, dolor de espalda, lumbalgia, esguince, torcedura de tobillo, fractura, golpe, dolor de hombro, dolor de cadera, artritis, lesión deportiva, tendinitis, dolor de cuello.' },
  { specialty: 'Neumología', title: 'Pulmones y respiración', content: 'Tos persistente por semanas, asma, silbido al respirar, falta de aire leve al hacer ejercicio, bronquitis, neumonía en recuperación, fumador con tos, apnea del sueño, ronquidos fuertes.' },
  { specialty: 'Neurología', title: 'Sistema nervioso', content: 'Dolor de cabeza frecuente, migraña, mareos, vértigo, hormigueo en manos o pies, adormecimiento, temblores, problemas de memoria, epilepsia en control, insomnio por causas neurológicas.' },
  { specialty: 'Oftalmología', title: 'Ojos y visión', content: 'Visión borrosa, ojos rojos, ardor en los ojos, ojo seco, lagañas, conjuntivitis, necesito lentes, ver doble, dolor de ojos, cataratas, revisión de la vista por diabetes.' },
  { specialty: 'Otorrinolaringología', title: 'Oído, nariz y garganta', content: 'Dolor de oído, zumbido en los oídos, no escucho bien, sinusitis, nariz tapada constante, sangrado de nariz leve, amigdalitis frecuente, ronquera, disfonía, dolor de garganta recurrente.' },
  { specialty: 'Psicología', title: 'Salud mental y emociones', content: 'Ansiedad, estrés, tristeza constante, depresión, ataques de pánico, problemas para dormir por preocupación, duelo, problemas de pareja o familia, autoestima, terapia psicológica.' },
];

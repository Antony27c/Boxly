const alumnos = [
    { nombre: "Ana",     nota: 8 },
    { nombre: "Carlos",  nota: 4 },
    { nombre: "Laura",   nota: 7 },
    { nombre: "Pedro",   nota: 3 },
    { nombre: "Sofía",   nota: 9 },
    { nombre: "Marcos",  nota: 6 },
    { nombre: "Valeria", nota: 2 },
];

const notas = alumnos.map(a => a.nota);

function calcularPromedio(notas) {
    const suma = notas.reduce((acumulador, nota) => acumulador + nota, 0);
    return suma / notas.length;
}

function filtrarAprobados(alumnos) {
    return alumnos.filter(alumno => alumno.nota >= 6);
}

function formatearAlumnos(alumnos) {
    return alumnos.map(alumno => `Nombre: ${alumno.nombre} - Nota: ${alumno.nota}`);
}

function buscarAlumno(alumnos, nombre) {
    return alumnos.find(alumno => alumno.nombre === nombre);
}

console.log("── (a) calcularPromedio ──────────────────");
console.log("Notas:", notas);
console.log("Promedio:", calcularPromedio(notas));

console.log("\n── (b) filtrarAprobados ──────────────────");
console.log("Todos los alumnos:", alumnos);
console.log("Aprobados:", filtrarAprobados(alumnos));

console.log("\n── (d) buscarAlumno ──────────────────────");
console.log("Buscar 'Laura':",  buscarAlumno(alumnos, "Laura"));    
console.log("Buscar 'Carlos':", buscarAlumno(alumnos, "Carlos"));
console.log("Buscar 'Juan':",   buscarAlumno(alumnos, "Juan")); 

console.log("\n── Prueba combinada ──────────────────────");
const aprobados         = filtrarAprobados(alumnos);
const aprobadosFormato  = formatearAlumnos(aprobados);
const promedioAprobados = calcularPromedio(aprobados.map(a => a.nota));

console.log("Aprobados formateados:", aprobadosFormato);
console.log("Promedio de aprobados:", promedioAprobados.toFixed(2));
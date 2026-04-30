 const input       = document.getElementById('input-tarea');
    const btnAgregar  = document.getElementById('btn-agregar');
    const lista       = document.getElementById('lista-tareas');
    const numPend     = document.getElementById('num-pendientes');
    const errorMsg    = document.getElementById('error-msg');
    const estadoVacio = document.getElementById('estado-vacio');
 
     
    function actualizarContador() {
        const pendientes = lista.querySelectorAll('.tarea:not(.completada)').length;
        numPend.textContent = pendientes;
    }
 
    
    function actualizarVacio() {
        const hayTareas = lista.children.length > 0;
        estadoVacio.classList.toggle('visible', !hayTareas);
    }
 
   
    function mostrarError() {
        errorMsg.classList.add('visible');
        input.focus();
        setTimeout(() => errorMsg.classList.remove('visible'), 2500);
    }
 
     
    function agregarTarea(texto) {
        texto = texto.trim();
  
        if (!texto) {
            mostrarError();
            return;
        }
 
        
        const li = document.createElement('li');
        li.classList.add('tarea');
 
        
        const check = document.createElement('div');
        check.classList.add('check');
        check.innerHTML = `<svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4L4 7.5L10 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
 
         
        const span = document.createElement('span');
        span.classList.add('tarea-texto');
        span.textContent = texto;
 
       
        const btnElim = document.createElement('button');
        btnElim.classList.add('btn-eliminar');
        btnElim.textContent = '×';
        btnElim.title = 'Eliminar tarea';
 
        btnElim.addEventListener('click', function(e) {
            e.stopPropagation(); 
            li.remove();        
            actualizarContador();
            actualizarVacio();
        });
 
        
        li.addEventListener('click', function() {
            li.classList.toggle('completada'); // (b)
            actualizarContador();              // (d)
        });
 
        // Armar el li
        li.appendChild(check);
        li.appendChild(span);
        li.appendChild(btnElim);
 
        lista.appendChild(li);
 
         
        input.value = '';
        input.focus();
 
        actualizarContador(); // (d)
        actualizarVacio();
    }
 
    
    btnAgregar.addEventListener('click', function(e) {
        e.preventDefault(); // (a)
        agregarTarea(input.value);
    });
  
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            agregarTarea(input.value);
        }
    });
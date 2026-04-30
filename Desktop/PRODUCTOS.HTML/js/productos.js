        const productos = [
            { id: 1, nombre: "Smartphone X", precio: 799, categoria: "Electrónica", enStock: true },
            { id: 2, nombre: "Laptop Pro", precio: 1299, categoria: "Electrónica", enStock: true },
            { id: 3, nombre: "Auriculares Inalámbricos", precio: 149, categoria: "Electrónica", enStock: false },
            { id: 4, nombre: "Camiseta Básica", precio: 19.99, categoria: "Ropa", enStock: true },
            { id: 5, nombre: "Zapatos Deportivos", precio: 89.99, categoria: "Ropa", enStock: true },
            { id: 6, nombre: "Libro de Cocina", precio: 24.99, categoria: "Libros", enStock: true },
            { id: 7, nombre: "Juego de Mesa", precio: 39.99, categoria: "Juguetes", enStock: false },
            { id: 8, nombre: "Mochila Resistente", precio: 49.99, categoria: "Accesorios", enStock: true },
            { id: 9, nombre: "Reloj Inteligente", precio: 199, categoria: "Electrónica", enStock: true },
            { id: 10, nombre: "Cámara Digital", precio: 349, categoria: "Electrónica", enStock: false },
            { id: 11, nombre: "Jeans Clásicos", precio: 59.99, categoria: "Ropa", enStock: true },
            { id: 12, nombre: "Novela Best Seller", precio: 14.99, categoria: "Libros", enStock: true }
        ];
 
        const productosContainer = document.getElementById('productos-container');
        const selectCategoria = document.getElementById('categoria');
        const inputPrecioMax = document.getElementById('precio-max');
        const valorPrecioMax = document.getElementById('valor-precio-max');
        const checkboxSoloStock = document.getElementById('solo-stock');
        const inputBusqueda = document.getElementById('busqueda');

         
        function cargarCategorias() {
            const categorias = [...new Set(productos.map(p => p.categoria))];
            categorias.forEach(categoria => {
                const option = document.createElement('option');
                option.value = categoria;
                option.textContent = categoria;
                selectCategoria.appendChild(option);
            });
        }

       
        function mostrarProductos(productosMostrar) {
            productosContainer.innerHTML = productosMostrar.map(producto => `
                <div class="producto-card ${!producto.enStock ? 'sin-stock' : ''}">
                    <h3>${producto.nombre}</h3>
                    <p class="precio">${producto.precio.toFixed(2)}</p>
                    <p class="categoria">${producto.categoria}</p>
                    <p>${producto.enStock ? 'Disponible' : 'Agotado'}</p>
                </div>
            `).join('');
        }
 
        function filtrarProductos() {
            const categoriaSeleccionada = selectCategoria.value;
            const precioMaximo = parseFloat(inputPrecioMax.value);
            const soloStock = checkboxSoloStock.checked;
            const textoBusqueda = inputBusqueda.value.toLowerCase();

            const productosFiltrados = productos.filter(producto => {
               
                const coincideCategoria = categoriaSeleccionada === 'todas' || producto.categoria === categoriaSeleccionada;
                
               
                const coincidePrecio = producto.precio <= precioMaximo;
                
                 
                const coincideStock = !soloStock || producto.enStock;
                 
                const coincideNombre = producto.nombre.toLowerCase().includes(textoBusqueda);
                
                return coincideCategoria && coincidePrecio && coincideStock && coincideNombre;
            });

            mostrarProductos(productosFiltrados);
        }
 
        selectCategoria.addEventListener('change', filtrarProductos);
        inputPrecioMax.addEventListener('input', () => {
            valorPrecioMax.textContent = `${inputPrecioMax.value}`;
            filtrarProductos();
        });
        checkboxSoloStock.addEventListener('change', filtrarProductos);
        inputBusqueda.addEventListener('input', filtrarProductos);
 
        cargarCategorias();
        mostrarProductos(productos);
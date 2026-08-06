leete esta documentacion y dime que opinas, pon mucho ojo, primero:

Lo que estaba pensando es en dividir el flujo en 2 aplicaciones, la primera de todas seria una aplicacion para la malla curricular, con las asignaturas y sus dependencias, luego, los datos que yo ingrese a esa aplicacion, deberian afectar directamente en mi otra aplicacion, que seria la de UniHorario, la froma en la que se conseguiria esto es mediante el uso de una base de datos compartida.

Disclaimer: La idea de una base de datos compartida es un borrador, por lo que existe la posibilidad de explorar otras soluciones como por ejemplo el uso de microservicios.

Todo esto seria servido atravez de un dashboard, en donde en el hub estarian las opciones de acceder a una app o la otra, es importante mencionar que el registro se haria en el dashobard, luego las apps tienen que interpretar ese registro y saber que usario esta conectado y cuales son sus datos en la db

La idea de esto es hacer todo mas escalable, en el sentido de que si quiero crear otra app, lo puedo hacer con extrema facilidad, y usando la db que ya existe, dispondiendo de los servicios que ya existen y asi...

El flujo completo seria el siguiente. El usuario accede a la app, en caso de no estar loggeado le pide loggearse, en caso de no tener cuenta le pide registrarse (tanto el registro como el log se harian con outlook, usando todos los dominios que terminen con "@ * uss * .cl"). La pantalla principal va a ser la vista de dashboard en donde se van a visualizar datos importartes y donde se va a ver un menu para cambiar de "aplicacion/servicio".

La idea es que todas las aplicaciones/servicios esten en repositorios diferentes, la idea es que la manera en la que funcione es con un directorio general, en donde se van a encontrar almacenados los repositorios y usando un docker compose up --build desde la raiz del directorio se levantarian todos los servicios/apps, es importante mencionar que todo esto va a estar en un vps

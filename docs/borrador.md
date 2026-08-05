leete esta documentacion y dime que opinas, pon mucho ojo, primero:

- tratar de escalar el proyecto dividiendolo, a lo que me refiero, es a tener una infraestructura basada en un dashboard desde donde se consultarian aplicaciones como esta, entonces la idea seria en que todas estas aplicaciones esten conectadas a una misma base de datos, entonces asi cualquier cambio que hagan se ve reflejado automaticamente en la base de datos, de la otra aplicacion, cual es la idea de esto, que si por ejemplo yo tengo una aplicacion independiente para todo lo que seria la malla curricular y los prerequisitos de cada ramo, que pueda en el fondo tenerlo como 2 aplicaciones diferentes, pero que se comuniquen entre si

Lo que estaba pensando es en dividir el flujo en 2 aplicaciones, la primera de todas seria una aplicacion para la malla curricular, con las asignaturas y sus dependencias, luego, los datos que yo ingrese a esa aplicacion, deberian afectar directamente en mi otra aplicacion, que seria la de UniHorario, la froma en la que se conseguiria esto es mediante el uso de una base de datos compartida.

Disclaimer: La idea de una base de datos compartida es un borrador, por lo que existe la posibilidad de explorar otras soluciones como por ejemplo el uso de microservicios.

Todo esto seria servido atravez de un dashboard, en donde en el hub estarian las opciones de acceder a una app o la otra, es importante mencionar que el registro se haria en el dashobard, luego las apps tienen que interpretar ese registro y saber que usario esta conectado y cuales son sus datos en la db

La idea de esto es hacer todo mas escalable, en el sentido de que si quiero crear otra app, lo puedo hacer con extrema facilidad, y usando la db que ya existe, dispondiendo de los servicios que ya existen y asi...

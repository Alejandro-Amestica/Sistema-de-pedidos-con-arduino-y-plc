const express = require('express');

const app = express();

const server = require('http').Server(app);

const io = require('socket.io')(server);

const five = require('johnny-five');

const mysql = require('mysql2');

const bcrypt = require('bcryptjs');

const cookieParser = require('cookie-parser');

const session = require('express-session');

const sharedSession = require('express-socket.io-session');



const sessionMiddleware = session({

  secret: 'feriatp',

  resave: false,

  saveUninitialized: false,

});



// Configuración de Express

app.use(express.static('public'));

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(cookieParser());

app.use(sessionMiddleware);



io.use(sharedSession(sessionMiddleware, { autoSave: true }));

app.use(express.static('public'));

app.use(express.urlencoded({ extended: true }));

app.use(express.json());



// Configuración de la conexión a la base de datos

const connection = mysql.createConnection({

  host: 'localhost',

  user: 'root',

  password: '',

  database: 'feriatp',

});





connection.connect((err) => {

  if (err) {

    console.error('Error al conectar a la base de datos:', err);

  } else {

    console.log('Conexión exitosa a la base de datos');

  }

});



// Rutas

app.get('/', (req, res) => {

  if (req.session.userId) {

    // El usuario ha iniciado sesión, enviar la página index.html con el nombre de usuario

    res.sendFile(__dirname + '/public/index.html', { username: req.session.username });

  } else {

    // El usuario no ha iniciado sesión, redirigir al formulario de inicio de sesión

    res.redirect('/login.html');

  }

});



app.get('/admin', (req, res) => {

  if (req.session.userId === 1 || req.session.userId === 2) {

    // El usuario es el administrador, enviar la página admin.html

    res.sendFile(__dirname + '/public/admin.html');

  } else {

    // Redirigir a la página de inicio si no es el administrador

    res.redirect('/index.html');

  }

});



app.get('/login-check', (req, res) => {

  if (req.session.userId) {

    // El usuario ha iniciado sesión, enviar el nombre de usuario como respuesta

    connection.query('SELECT nombre FROM users WHERE id = ?', [req.session.userId], (error, results) => {

      if (error) {

        console.log(error);

        res.status(500).send('Error de servidor');

      } else {

        if (results.length > 0) {

          const username = results[0].nombre;

          res.status(200).send({ nombre: username });

        } else {

          res.status(401).send('Credenciales inválidas');

        }

      }

    });

  } else {

    // El usuario no ha iniciado sesión, enviar un mensaje de error

    res.status(401).send('Sesión no iniciada');

  }

});



app.get('/pedidos-pendientes', (req, res) => {

  // Consultar los pedidos pendientes en la base de datos

  connection.query('SELECT * FROM pedidos WHERE estado = "pendiente"', (error, results) => {

    if (error) {

      console.log(error);

      res.status(500).send('Error de servidor');

    } else {

      // Devolver los pedidos como respuesta en formato JSON, incluyendo el estado

      res.status(200).json({ pedidos: results });

    }

  });

});



app.get('/pedidos-confirmados', (req, res) => {

  // Consultar los pedidos confirmados en la base de datos

  connection.query('SELECT * FROM pedidos WHERE estado = "confirmado"', (error, results) => {

    if (error) {

      console.log(error);

      res.status(500).send('Error de servidor');

    } else {

      // Devolver los pedidos como respuesta en formato JSON, incluyendo el estado

      res.status(200).json({ pedidos: results });

    }

  });

});



app.get('/pedidos-rechazados', (req, res) => {

  // Consultar los pedidos rechazados en la base de datos

  connection.query('SELECT * FROM pedidos WHERE estado = "rechazado"', (error, results) => {

    if (error) {

      console.log(error);

      res.status(500).send('Error de servidor');

    } else {

      // Devolver los pedidos como respuesta en formato JSON, incluyendo el estado

      res.status(200).json({ pedidos: results });

    }

  });

});



app.post('/confirmar-pedido/:id', (req, res) => {

  const pedidoId = req.params.id;



  // Actualizar el estado del pedido en la base de datos a 'confirmado'

  connection.query('UPDATE pedidos SET estado = "confirmado" WHERE id = ?', [pedidoId], (error, results) => {

    if (error) {

      console.log(error);

      res.status(500).send('Error de servidor');

    } else {

      if (results.affectedRows > 0) {

        // Pedido confirmado correctamente

        res.status(200).send('Pedido confirmado');

        

        // Emitir el evento 'pedido-confirmado' a todos los clientes, incluido el cliente administrador

        io.emit('pedido-confirmado', { id: pedidoId });

      } else {

        // No se encontró el pedido

        res.status(404).send('Pedido no encontrado');

      }

    }

  });

});



app.post('/rechazar-pedido/:id', (req, res) => {

  const pedidoId = req.params.id;



  // Actualizar el estado del pedido en la base de datos a 'rechazado'

  connection.query('UPDATE pedidos SET estado = "rechazado" WHERE id = ?', [pedidoId], (error, results) => {

    if (error) {

      console.log(error);

      res.status(500).send('Error de servidor');

    } else {

      if (results.affectedRows > 0) {

        // Pedido rechazado correctamente

        res.status(200).send('Pedido rechazado');

        

        // Emitir el evento 'pedido-rechazado' a todos los clientes, incluido el cliente administrador

        io.emit('pedido-rechazado', { id: pedidoId });

      } else {

        // No se encontró el pedido

        res.status(404).send('Pedido no encontrado');

      }

    }

  });

});



app.post('/login', (req, res) => {

  const { nombre, password } = req.body;

  console.log('Datos recibidos:', nombre, password); // Agregado para verificar los datos recibidos

  console.log('Usuario:', nombre);

  console.log('Contraseña:', password);

  

  // Verificar las credenciales en la base de datos

  connection.query('SELECT * FROM users WHERE nombre = ?', [nombre], (error, results) => {

    if (error) {

      console.log(error);

      res.status(500).send('Error de servidor');

    } else {

      if (results.length > 0) {

        const user = results[0];



        // Verificar la contraseña utilizando bcrypt

        bcrypt.compare(password, user.password, (err, result) => {

          if (result) {

            // Credenciales válidas, establecer la sesión del usuario

            req.session.userId = user.id;

            req.session.username = user.nombre; // Establecer el nombre de usuario en la sesión

            res.status(200).send('Inicio de sesión exitoso');

          } else {

            res.status(401).send('Credenciales inválidas');

          }

        });

      } else {

        res.status(401).send('Credenciales inválidas');

      }

    }

  });

});



app.post('/logout', (req, res) => {

  // Destruir la sesión y redirigir al formulario de inicio de sesión

  req.session.destroy((err) => {

    if (err) {

      console.error(err);

    }

    res.status(200).send('Sesión cerrada');

  });

});



app.post('/register', (req, res) => {

  const { nombre, email, password } = req.body;

  console.log('Datos recibidos:', nombre, email, password); // Verificar los datos recibidos



  // Verificar si el usuario ya está registrado en la base de datos

  connection.query('SELECT * FROM users WHERE email = ?', [email], (error, results) => {

    if (error) {

      console.log(error);

      res.status(500).send('Error de servidor');

    } else {

      if (results.length > 0) {

        res.status(409).send('El usuario ya está registrado');

      } else {

        if (!password) {

          res.status(400).send('La contraseña no puede estar vacía');

        } else {

          // Cifrar la contraseña utilizando bcrypt

          bcrypt.genSalt(10, (err, salt) => {

            if (err) {

              console.log(err);

              res.status(500).send('Error de servidor');

            } else {

              bcrypt.hash(password, salt, (err, hashedPassword) => {

                if (err) {

                  console.log(err);

                  res.status(500).send('Error de servidor');

                } else {

                  // Guardar al usuario en la base de datos

                  connection.query('INSERT INTO users (nombre, email, password) VALUES (?, ?, ?)', [nombre, email, hashedPassword], (error, results) => {

                    if (error) {

                      console.log(error);

                      res.status(500).send('Error de servidor');

                    } else {

                      // Registro exitoso, redirigir a la página de inicio de sesión

                      res.redirect('/login.html');

                    }

                  });

                }

              });

            }

          });

        }

      }

    }

  });

});



// Configuración de Socket.io

io.on('connection', (socket) => {

  console.log('Cliente conectado');



socket.on('pedido1', (pedidoData) => {

  console.log('Pedido enviado: ', pedidoData.tipoPedido, pedidoData.sizeValue);

  // Obtener el nombre de usuario del pedido

  const username = socket.handshake.session.username;

  let duracionPulso;



  // Agua

  if (relay) {

    relay.open();

    duracionPulso = pedidoData.sizeValue === 'grande' ? 600 : 300;

    console.log('Duración del pulso:', duracionPulso); // <--- Agrega esta línea para mostrar el valor de duracionPulso

    setTimeout(() => {

      relay.close();

    }, duracionPulso); // Mantén el pulso durante x milisegundos (ajusta según tus necesidades)

  }



  if (relay4) {

    relay4.open();

    duracionPulso = pedidoData.sizeValue === 'grande' ? 600 : 300;

    console.log('Duración del pulso:', duracionPulso); // <--- Agrega esta línea para mostrar el valor de duracionPulso    

    setTimeout(() => {

      relay4.close();

    }, duracionPulso); // Mantén el pulso durante x milisegundos (ajusta según tus necesidades)

  }



  // Guardar el pedido en la base de datos

  connection.query('INSERT INTO pedidos (usuario, consumible, tamano, estado) VALUES (?, ?, ?, "pendiente")', [username, pedidoData.tipoPedido, pedidoData.sizeValue], (error, results) => {

    if (error) {

      console.log(error);

    } else {

      console.log('Pedido guardado en la base de datos');

      const pedidoId = results.insertId;



      // Emitir el evento 'pedido' a todos los clientes, incluido el cliente administrador

      io.emit('pedido', { id: pedidoId, usuario: username, consumible: pedidoData.tipoPedido, tamano: pedidoData.sizeValue, estado: 'pendiente' });

    }

  });

});



socket.on('pedido2', (pedidoData) => {

  console.log('Pedido enviado: ', pedidoData.tipoPedido, pedidoData.sizeValue);

  // Obtener el nombre de usuario del pedido

  const username = socket.handshake.session.username;

  let duracionPulso;

  // BEBIDA PULSO

  if (relay3) {

    relay3.open();

    duracionPulso = pedidoData.sizeValue === 'grande' ? 600 : 300;

    console.log('Duración del pulso:', duracionPulso); // <--- Agrega esta línea para mostrar el valor de duracionPulso    

    setTimeout(() => {

      relay3.close();

    }, duracionPulso); // Mantén el pulso durante x milisegundos (ajusta según tus necesidades)

  }



  if (relay6) {

    relay6.open();

    duracionPulso = pedidoData.sizeValue === 'grande' ? 600 : 300;

    console.log('Duración del pulso:', duracionPulso); // <--- Agrega esta línea para mostrar el valor de duracionPulso    

    setTimeout(() => {

      relay6.close();

    }, duracionPulso); // Mantén el pulso durante x milisegundos (ajusta según tus necesidades)

  }



  // Guardar el pedido en la base de datos

  connection.query('INSERT INTO pedidos (usuario, consumible, tamano, estado) VALUES (?, ?, ?, "pendiente")', [username, pedidoData.tipoPedido, pedidoData.sizeValue], (error, results) => {

    if (error) {

      console.log(error);

    } else {

      console.log('Pedido guardado en la base de datos');

      const pedidoId = results.insertId;



      // Emitir el evento 'pedido' a todos los clientes, incluido el cliente administrador

      io.emit('pedido', { id: pedidoId, usuario: username, consumible: pedidoData.tipoPedido, tamano: pedidoData.sizeValue, estado: 'pendiente' });

    }

  });

});



socket.on('pedido-confirmado', (pedidoId) => {

  // Emitir el evento 'pedido-confirmado' a todos los clientes, incluido el cliente administrador

  io.emit('pedido-confirmado', { id: pedidoId });

});



socket.on('pedido-rechazado', (pedidoId) => {

  // Emitir el evento 'pedido-rechazado' a todos los clientes, incluido el cliente administrador

  io.emit('pedido-rechazado', { id: pedidoId });

});



    // Escuchar el evento 'pulso' enviado desde el cliente

    socket.on('pulso', (duration) => {

      // Hacer que el relay2 se active durante la duración del pulso

      relay2.open();

      relay5.open();

      setTimeout(() => {

        relay2.close();

  relay5.close();

      }, duration);

    });





  socket.on('disconnect', () => {

    console.log('Cliente desconectado');

  });

});



// Inicialización de Johnny-Five

const board = new five.Board({ port: '/dev/ttyUSB0' });



let relay; // Variable para almacenar el objeto del relé



board.on('ready', () => {

  console.log('Arduino listo');



  // Configuración de los pines del Arduino

  relay = new five.Relay(13); // Usa el pin 13 para el relé

  relay2 = new five.Relay(9); // Usa el pin 9 para el relé

  relay3 = new five.Relay(11); // Usa el pin 11 para el relé



  relay4 = new five.Relay(10); // Usa el pin 10 para el relé

  relay5 = new five.Relay(7); //USa el pin 7 para el relé

  relay6 = new five.Relay(12); //Usa el pin 12 para el relé

  // Inicio del servidor

  const port = 3000;

  server.listen(port, () => {

    console.log(`Servidor escuchando en http://localhost:${port}`);

  });

});  



process.stdin.resume();

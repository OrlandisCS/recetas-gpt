//TODO: Primera fase del codigo
//TODO: Refactorizar y limpiar codigo
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import axios from 'axios';
import { Configuration, OpenAIApi } from 'openai';
import { dbConection } from './db/conection.js';
import Flickr from 'flickr-sdk';
import GoogleImages from 'google-images';

import Receta from './models/recetas.js';
import Blog from './models/blog.js';
import cron from 'node-cron';

dotenv.config();

const client = new GoogleImages(
	process.env.GOOGLE_CSID,
	process.env.GOOGLE_IMAGES_KEY
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const flickr = new Flickr(process.env.FLICKR_API_KEY);
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

dbConection();
const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

/* const rolPromt =
	'Simula ser el chef de un blog de cocina tradicional el cual dará recetas de la abuela, si te digo receta o recetas dame una receta aleatoria sencilla de elaborar, Responderás mis dudas de manera de didáctica. Proveerás al menos un ejemplo del concepto o duda. Cuando realice una pregunta que no esté relacionada con temas de cocina, responderás: Lo siento, solo estoy habilitado para responderte dudas sobre las temáticas de recetas y/o cocina. Me diras un nombre para la receta este nombre tiene que estar relacionado con la receta,tiempo de preparacion de la receta, tiempo de coccion de la receta, porciones de la receta,dificultad de la receta y una descripcion de la receta que ha de tener 250 caracteres.No te olvides los ingredientes y pasos a seguir para la receta.';
 */
const role = `Eres un chef experto en hacer recetas tradicionales.Te llamas chefsito. supongamos que eres un usuario cualquiera el cual se ha levantado sin ganas de complicarse la vida, por tanto te pediré una receta el cual le darás una respuesta de la receta.En caso de decirte receta o resetas me darás una receta aleatoria.
Que conste que solo tienes que dar la receta sin más.
En caso de que te pidan algo no relacionado con recetas responderas: "Lo siento solo estoy habilitado para responder a dudas sobre cocina".
La respuesta la puedes representar en un ejemplo de codigo HTML.Dicho ejemplo ha de tener este formato "<ul><li></li></ul>" y el ejemplo de los pasos a seguir estarán enumerados tendra este formato "<section><ul><li></li></ul></section>".
Respuesta: `;

console.log('\n');

console.log(chalk.blue('Servicio de chat para recetas iniciado...'));
console.log('\n');
console.log(
	chalk.cyan('<------------------ Recetas Bot ------------------>')
);
console.log('\n');
const ACCESS_KEY = 'U_v4WBqnsULvml4mRlF0Mjs9qFUp0msN7j76YHQCMW8';
const BASE_URL = 'https://api.unsplash.com';
const notAvailable =
	'https://st2.depositphotos.com/1560768/6162/i/600/depositphotos_61621057-stock-photo-no-image-available.jpg';
async function searchPhotos(query) {
	try {
		const response = await axios.get(
			`${BASE_URL}/photos/random/?query=${query}&client_id=${ACCESS_KEY}`
		);
		console.log(response);
		return response.data.urls.small;
	} catch (error) {
		console.error(error);
		return notAvailable;
	}
}
async function searchPhotosPixabay(query) {
	const ACCESS_KEY = '35774218-1e7132c4b9faf9709fa0ba5ec';
	const BASE_URL = `https://pixabay.com/api/?key=${ACCESS_KEY}&lang=es&q=${query}&image_type=photo&orientation=horizontal`;
	try {
		const response = await axios.get(BASE_URL);
		if (response.data.hits.length > 0) {
			return response.data.hits[1].webformatURL;
		}
		return await searchPhotos(query);
	} catch (error) {
		console.error(error);
		return notAvailable;
	}
}

async function imageByGoogle(query) {
	try {
		const photo = await client.search(query);
		if (photo) {
			const img = photo.filter((image) => {
				if (
					image.url.includes('jpg') ||
					image.url.includes('png') ||
					image.url.includes('jpeg')
				) {
					return image;
				}
			});
			return img[0].url;
		}
		return await fenerateFlickrImage(query);
	} catch (error) {
		console.log(error);
		return notAvailable;
	}
}
const fenerateFlickrImage = async (query) => {
	try {
		const image = await flickr.photos.search({
			text: query,
			tags: ['comida'],
		});
		const photo = image.body.photos.photo[0];
		if (photo) {
			const url = `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`;
			return url;
		}
		return await searchPhotosPixabay(query);
	} catch (error) {
		console.log(error);
		return notAvailable;
	}
};
const generaUnNombre = async (receta) => {
	const completion = await openai.createChatCompletion({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'user',
				content: `Simula ser un generador de nombre de recetas, dada esta receta ${receta} genera un nombre para esta receta.El nombre ha de ser el nombre de la comida seguido de la otra palabra, No uses mas de dos palabras para el nombre y este ha de tener sentido comun.por ejemplo: "Comida italiana": Spaghetti alla Carbonara en ves de Carbonara cremosa. abstente de usar las palabras como casero,clasica, clasico, asombroso o palabras de este estilo. Solo quiero el nombre`,
			},
		],
	});
	return completion.data.choices[0].message.content;
};

const generarDificultad = async (receta) => {
	const completion = await openai.createChatCompletion({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'user',
				content: `Dada está receta "${receta}" dime que dificultad tendria hacerla,usando este rango de dificultad:"Facil","Normal","Medio","Dificil". Solo quiero el nombre de la dificultad`,
			},
		],
	});
	return completion.data.choices[0].message.content;
};
const generarTiempo = async (receta) => {
	const completion = await openai.createChatCompletion({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'user',
				content: `dado el nombre de una receta dime cual es el tiempo de preparación. Solo quiero el tiempo de preparación sin más. Ejemplo de respuesta: 30 minutos. Receta: "${receta}"`,
			},
		],
	});
	return completion.data.choices[0].message.content;
};
const generarMetodo = async (receta) => {
	const completion = await openai.createChatCompletion({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'user',
				content: `Dada está receta "${receta}", Dime en que electrodomestico se haria, usa "Hornillos","Horno","Microondas".Solo quiero el nombre del electrodomestico`,
			},
		],
	});
	return completion.data.choices[0].message.content;
};
const generaUnadescripcion = async (receta) => {
	const completion = await openai.createChatCompletion({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'user',
				content: `${receta} Dime una descripcion para esta receta,la descripción ha de estar relacionado con la receta,la descripcion solo puede tener una longitud de 250 caracteres como maximo,solo quiero la descripción sin más`,
			},
		],
	});
	return completion.data.choices[0].message.content;
};
const guardarEnDB = async (
	receta,
	nombre,
	decripcion,
	imagen,
	dificultad,
	tiempo,
	metodo
) => {
	const guardarDatos = new Receta({
		receta,
		nombre,
		decripcion,
		imagen,
		dificultad,
		tiempo,
		metodo,
	});
	await guardarDatos.save();
	console.log('receta guardada...');
};
app.get('/', async (req, res) => {
	res.sendFile('dist', 'index.html');
});
app.post('/sendPrompt', async (req, res) => {
	console.log('\n');

	const { userPrompt } = req.body;

	const situacion = `
	Hola quiero una receta de: ${userPrompt}
	`;
	if (
		userPrompt.trim().length <= 0 ||
		userPrompt.trim().length === ''
	) {
		return res.status(200).json({
			role: 'System',
			content: `Deberia hacer una consulta \n por favor realice una consulta sobre alguna receta\n que tenga en mente,\n y nuestro chef virtual le responderá con gusto`,
		});
	}
	if (userPrompt) {
		console.log(
			chalk.cyan(
				'<-------------------------------------------------->'
			)
		);
		console.log('\n');

		console.log(chalk.blue(`consultando ${userPrompt}...`));
		console.log('\n');

		//consultar en la base de datos
		const buscarEnDB = await Receta.find({
			nombre: { $regex: userPrompt, $options: 'i' },
		});
		if (buscarEnDB.length > 0) {
			const obtenerRecetaAleatoria = (max) => {
				return Math.floor(Math.random() * max);
			};
			const recetaDB =
				buscarEnDB[obtenerRecetaAleatoria(buscarEnDB.length)];
			return res.status(200).json({
				mensaje:
					'He encontrado una receta similar en nuestra base de datos',
				data: recetaDB.receta,
			});
		}

		const completion = await openai.createChatCompletion({
			model: 'gpt-3.5-turbo',
			messages: [
				{
					role: 'system',
					content: role,
				},
				{
					role: 'user',
					content: situacion,
				},
			],
		});
		const response = completion.data.choices[0].message.content;

		const nombre = await generaUnNombre(
			userPrompt === 'random' ? response : userPrompt
		);
		const description = await generaUnadescripcion(response);
		const imagen = await imageByGoogle(nombre);
		const dificultad = await generarDificultad(nombre);
		const tiempo = await generarTiempo(nombre);
		const metodo = await generarMetodo(nombre);
		//const imagen = await fenerateFlickrImage(nombre);
		//const imagen = await searchPhotosPixabay(nombre);
		//const imagen = await searchPhotos(userPrompt);
		await guardarEnDB(
			response,
			nombre,
			description,
			imagen,
			dificultad,
			tiempo,
			metodo
			//data.photos[0].src.original
		);

		console.log('\n');
		console.log(
			chalk.cyan(
				'<-------------------------------------------------->'
			)
		);
		console.log(chalk.blue('Gracias por usar nuestras recetas'));
		return res.status(200).json({
			mensaje: 'He encontrado esta receta para ti',
			data: completion.data.choices[0].message.content,
		});
	}
});

app.get('/recetas', async (req, res) => {
	try {
		const recetas = await Receta.find().sort({ createdAt: -1 });
		res.status(200).json(recetas);
	} catch (error) {
		res.status(400).send(error);
		throw new Error(error);
	}
});

app.get('/fotos', async (req, res) => {
	const { query } = req.query;
	/* 	console.log('Consultando: ', query);
	const image = await fenerateFlickrImage(query); */

	const images = await client.search(query, { size: 'xlarge' });
	res.status(200).json(images);
});

//TODO: Iniciar blog fecth
const blogRole = `Simula ser un experto generador de contenido de un blog dedicado a generar contenido de cocina. los temas pueden ser desde "recetas, cocina, limpìeza ".
La respuesta la puedes representar en un ejemplo de codigo HTML.Dicho ejemplo ha de tener este formato "<ul><li></li></ul>" y el ejemplo de los pasos a seguir estarán enumerados tendra este formato "<section><ul><li></li></ul></section>".
Respuesta: `;

const generateBlogContent = async () => {
	const completion = await openai.createChatCompletion({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'system',
				content: blogRole,
			},
		],
	});
	const response = completion.data.choices[0].message.content;
	const descripcion = await generaUnadescripcionBlog(response);
	const nombre = await generarNombreBlog(response);
	const paraImagen = await generarNombreImage(nombre);

	console.log({ paraImagen });
	const imagen = await generarImagenBlog(paraImagen);
	return guardarBlogEnDB(nombre, response, imagen, descripcion);
};

const generarImagenBlog = async (nombre) => {
	return await imageByGoogle(nombre);
};
const generarNombreImage = async (blog) => {
	const completion = await openai.createChatCompletion({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'user',
				content: `Dado este nombre de blog, genera un nombre adecuado para buscar una imagen en google. Solo genera el nombre.El nombre ha de ser corto para facilitar la busqueda en google. No ha de contener caracteres especiales y debe tener sentido dicho nombre
				Nombre: ${blog}`,
			},
		],
	});
	return completion.data.choices[0].message.content
		.replace('"', '')
		.replace('"', '');
};
const generarNombreBlog = async (blog) => {
	const completion = await openai.createChatCompletion({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'user',
				content: `Simula ser un generador de nombre para un blog, dada la siguiente redacción ${blog} genera un nombre para dicho articulo.Solo quiero el nombre`,
			},
		],
	});
	return completion.data.choices[0].message.content;
};
const guardarBlogEnDB = async (nombre, blog, imagen, descripcion) => {
	const guardarDatos = new Blog({
		nombre,
		blog,
		imagen,
		descripcion,
	});
	await guardarDatos.save();
	console.log('blog guardado...');
};

const generaUnadescripcionBlog = async (blog) => {
	const completion = await openai.createChatCompletion({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'user',
				content: `${blog} Dime una descripcion para este blof,la descripción ha de estar relacionado con la redacción del blog,la descripcion solo puede tener una longitud de 250 caracteres como maximo,solo quiero la descripción sin más`,
			},
		],
	});
	return completion.data.choices[0].message.content;
};
await generateBlogContent();
app.get('/articulos', async (req, res) => {
	const blogs = await Blog.find();
	res.status(200).json(blogs);
});
app.listen(process.env.USEPORT, () => {
	console.log(`app listening on port ${process.env.USEPORT}`);
});

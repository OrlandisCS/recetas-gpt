import { fileURLToPath } from 'url';
import path from 'path';

import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import axios from 'axios';
import { Configuration, OpenAIApi } from 'openai';
import { dbConection } from './db/conection.js';
import Receta from './models/recetas.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const generaUnNombre = async (receta) => {
	const completion = await openai.createChatCompletion({
		model: 'gpt-3.5-turbo',
		messages: [
			{
				role: 'user',
				content: `${receta} Dime un nombre para esta receta.El nombre ha de estar relacionado con la receta, Solo quiero el nombre`,
			},
		],
	});
	return completion.data.choices[0].message.content;
};
const generaUnadescrion = async (receta) => {
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
const guardarEnDB = async (receta, nombre, decripcion, imagen) => {
	const guardarDatos = new Receta({
		receta,
		nombre,
		decripcion,
		imagen,
	});
	await guardarDatos.save();
	console.log('receta guardada...');
};

app.get('/', async (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', 'index.html'));
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
		return res.json({
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
		const { data } = await axios.get(
			`https://api.pexels.com/v1/search?query=comida ${userPrompt}&orientation=landscape&locale=es-ES&per_page=1`,
			{
				headers: {
					Authorization: process.env.PEXELSKEY,
				},
			}
		);
		const response = completion.data.choices[0].message.content;
		setTimeout(async () => {
			const nombre = await generaUnNombre(response);
			const description = await generaUnadescrion(response);
			await guardarEnDB(
				response,
				nombre,
				description,
				data.photos[0].src.original
			);
		}, 1500);

		console.log(chalk.cyan('imagen: ' + data.photos[0].src.original));
		console.log(chalk.cyan(response));
		console.log('\n');
		console.log(
			chalk.cyan(
				'<-------------------------------------------------->'
			)
		);
		console.log(chalk.blue('Gracias por usar nuestras recetas'));
		return res.json(completion.data.choices[0].message);
	}
});

app.get('/recetas', async (req, res) => {
	const recetas = await Receta.find().sort({ createdAt: -1 });
	res.json(recetas);
});

app.listen(process.env.USEPORT, () => {
	console.log(`app listening on port ${process.env.USEPORT}`);
});

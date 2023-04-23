import { Schema, model } from 'mongoose';

const RecetasSchema = Schema(
	{
		nombre: { type: String, required: true },
		decripcion: { type: String, required: true },
		receta: { type: String, required: true },
		imagen: { type: String, required: true },
	},
	{ timestamps: true }
);

export default model('Receta', RecetasSchema);

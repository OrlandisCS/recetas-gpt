import { Schema, model } from 'mongoose';

const BlogSchema = Schema(
	{
		nombre: { type: String, required: true },
		blog: { type: String, required: true },
		imagen: { type: String, required: true },
		descripcion: { type: String, required: true },
	},
	{ timestamps: true }
);

export default model('Blog', BlogSchema);

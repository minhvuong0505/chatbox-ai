const csv = require("csv-parser");
const fs = require('fs');
const Logger = require('../utils/logger');

class VectorDatabaseService {
    constructor(modelService) {
        this.modelService = modelService;
        this.database = [];
    }

    async loadFromCsv(filePath) {
        return new Promise((resolve, reject) => {
            const data = [];
            fs.createReadStream(filePath)
                .pipe(csv())
                .on("data", (row) => {
                    if (row.Question && row.Answer) {
                        data.push({ question: row.Question, answer: row.Answer });
                    }
                })
                .on("end", async () => {
                    try {
                        const embeddings = await this.modelService.generateEmbeddings(
                            data.map(d => d.question)
                        );
                        
                        this.database = data.map((d, i) => ({
                            ...d,
                            embedding: Array.from(embeddings[i].data)
                        }));
                        
                        Logger.log('Database loaded', true, '', 'system');
                        resolve(true);
                    } catch (error) {
                        Logger.log('Error processing embeddings', error, '', 'error');
                        reject(error);
                    }
                })
                .on("error", (error) => {
                    Logger.log('Error loading vector database', error, '', 'error');
                    reject(error);
                });
        });
    }

    async search(query, similarityThreshold = 0.7, limit = 1) {
        const queryEmbedding = await this.modelService.generateEmbeddings(query);
        const queryVector = Array.from(queryEmbedding.data);
        
        const results = this.database
            .map(d => ({
                question: d.question,
                answer: d.answer,
                similarity: this.cosineSimilarity(queryVector, d.embedding)
            }))
            .filter(d => d.similarity >= similarityThreshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        return results.length > 0 ? results : [];
    }

    cosineSimilarity(vecA, vecB) {
        if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
            Logger.log('Invalid vectors', { vecA, vecB }, '', 'error');
            return null;
        }

        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        
        return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : null;
    }
}

module.exports = VectorDatabaseService;

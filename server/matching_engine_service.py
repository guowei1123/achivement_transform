from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from matching_engine import get_matching_engine, initialize_matching_engine
import numpy as np

app = Flask(__name__)
CORS(app)

matching_engine = None

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'engine_initialized': matching_engine is not None and matching_engine.is_initialized
    })

@app.route('/initialize', methods=['POST'])
def initialize_engine():
    global matching_engine
    
    try:
        data = request.json
        nodes = data.get('nodes', [])
        edges = data.get('edges', [])
        config = data.get('config', {})
        
        matching_engine = get_matching_engine(config)
        success = initialize_matching_engine(nodes, edges, config)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Matching engine initialized successfully',
                'stats': matching_engine.get_engine_stats()
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to initialize matching engine'
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/match', methods=['POST'])
def match_demand():
    global matching_engine
    
    if matching_engine is None or not matching_engine.is_initialized:
        return jsonify({
            'success': False,
            'error': 'Matching engine not initialized'
        }), 400
    
    try:
        data = request.json
        demand = data.get('demand', {})
        top_k = data.get('top_k', 10)
        
        recommendations = matching_engine.match_demand_to_achievements(demand, top_k)
        
        return jsonify({
            'success': True,
            'recommendations': recommendations,
            'count': len(recommendations)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/batch-match', methods=['POST'])
def batch_match():
    global matching_engine
    
    if matching_engine is None or not matching_engine.is_initialized:
        return jsonify({
            'success': False,
            'error': 'Matching engine not initialized'
        }), 400
    
    try:
        data = request.json
        demands = data.get('demands', [])
        top_k = data.get('top_k', 10)
        
        results = matching_engine.batch_match_demands(demands, top_k)
        
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/feedback', methods=['POST'])
def record_feedback():
    global matching_engine
    
    if matching_engine is None:
        return jsonify({
            'success': False,
            'error': 'Matching engine not initialized'
        }), 400
    
    try:
        data = request.json
        demand_id = data.get('demand_id')
        achievement_id = data.get('achievement_id')
        feedback_type = data.get('feedback_type')
        scores = data.get('scores', {})
        
        matching_engine.record_feedback(demand_id, achievement_id, feedback_type, scores)
        
        return jsonify({
            'success': True,
            'message': 'Feedback recorded successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/performance', methods=['GET'])
def get_performance():
    global matching_engine
    
    if matching_engine is None:
        return jsonify({
            'success': False,
            'error': 'Matching engine not initialized'
        }), 400
    
    try:
        report = matching_engine.get_performance_report()
        return jsonify({
            'success': True,
            'report': report
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    global matching_engine
    
    if matching_engine is None:
        return jsonify({
            'success': False,
            'error': 'Matching engine not initialized'
        }), 400
    
    try:
        stats = matching_engine.get_engine_stats()
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/export', methods=['POST'])
def export_recommendations():
    global matching_engine
    
    if matching_engine is None:
        return jsonify({
            'success': False,
            'error': 'Matching engine not initialized'
        }), 400
    
    try:
        data = request.json
        recommendations = data.get('recommendations', [])
        format_type = data.get('format', 'json')
        
        if format_type == 'csv':
            csv_content = matching_engine.export_recommendations_csv(recommendations)
            return jsonify({
                'success': True,
                'content': csv_content,
                'format': 'csv'
            })
        else:
            json_content = matching_engine.export_recommendations_json(recommendations)
            return jsonify({
                'success': True,
                'content': json_content,
                'format': 'json'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/save-models', methods=['POST'])
def save_models():
    global matching_engine
    
    if matching_engine is None:
        return jsonify({
            'success': False,
            'error': 'Matching engine not initialized'
        }), 400
    
    try:
        data = request.json
        path = data.get('path', './models/matching_engine')
        
        matching_engine.save_models(path)
        
        return jsonify({
            'success': True,
            'message': f'Models saved to {path}'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/load-models', methods=['POST'])
def load_models():
    global matching_engine
    
    try:
        data = request.json
        path = data.get('path', './models/matching_engine')
        
        success = matching_engine.load_models(path)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Models loaded from {path}'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to load models'
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/update-parameters', methods=['POST'])
def update_parameters():
    global matching_engine
    
    if matching_engine is None:
        return jsonify({
            'success': False,
            'error': 'Matching engine not initialized'
        }), 400
    
    try:
        data = request.json
        parameters = data.get('parameters', {})
        
        matching_engine.update_parameters(parameters)
        
        return jsonify({
            'success': True,
            'message': 'Parameters updated successfully',
            'parameters': matching_engine.score_fusion.get_weights()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    print(f"Starting Matching Engine Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)

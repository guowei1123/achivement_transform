from typing import List, Dict, Any, Optional, Callable
import numpy as np

class RuleConstraintFilter:
    def __init__(self):
        self.tech_field_compatibility = self._init_tech_field_compatibility()
        self.trl_requirements = self._init_trl_requirements()
        self.region_priorities = self._init_region_priorities()
        self.cooperation_mode_compatibility = self._init_cooperation_modes()
    
    def _init_tech_field_compatibility(self) -> Dict[str, List[str]]:
        return {
            '人工智能': ['人工智能', '智能制造', '电子信息'],
            '智能制造': ['智能制造', '人工智能', '新材料'],
            '新材料': ['新材料', '智能制造', '航空航天'],
            '新能源': ['新能源', '节能环保', '电子信息'],
            '生物医药': ['生物医药', '新材料', '人工智能'],
            '电子信息': ['电子信息', '人工智能', '智能制造'],
            '航空航天': ['航空航天', '新材料', '智能制造'],
            '海洋工程': ['海洋工程', '新材料', '智能制造'],
            '节能环保': ['节能环保', '新能源', '新材料'],
            '交通运输': ['交通运输', '智能制造', '新能源']
        }
    
    def _init_trl_requirements(self) -> Dict[int, Dict[str, Any]]:
        return {
            1: {'min_trl': 1, 'max_trl': 3, 'description': '概念研究阶段'},
            2: {'min_trl': 1, 'max_trl': 4, 'description': '概念验证阶段'},
            3: {'min_trl': 2, 'max_trl': 5, 'description': '实验室验证阶段'},
            4: {'min_trl': 3, 'max_trl': 6, 'description': '组件验证阶段'},
            5: {'min_trl': 4, 'max_trl': 7, 'description': '系统验证阶段'},
            6: {'min_trl': 5, 'max_trl': 8, 'description': '演示验证阶段'},
            7: {'min_trl': 6, 'max_trl': 9, 'description': '实际运行阶段'},
            8: {'min_trl': 7, 'max_trl': 9, 'description': '完成定型阶段'},
            9: {'min_trl': 8, 'max_trl': 9, 'description': '成功部署阶段'}
        }
    
    def _init_region_priorities(self) -> Dict[str, List[str]]:
        return {
            '华北': ['华北', '全国'],
            '华东': ['华东', '全国'],
            '华南': ['华南', '全国'],
            '华中': ['华中', '全国'],
            '西南': ['西南', '全国'],
            '西北': ['西北', '全国'],
            '东北': ['东北', '全国'],
            '全国': ['华北', '华东', '华南', '华中', '西南', '西北', '东北', '全国']
        }
    
    def _init_cooperation_modes(self) -> Dict[str, List[str]]:
        return {
            '技术转让': ['技术转让', '授权使用'],
            '技术入股': ['技术入股', '联合开发'],
            '联合开发': ['联合开发', '技术入股', '合作生产'],
            '技术服务': ['技术服务', '技术转让'],
            '授权使用': ['授权使用', '技术转让'],
            '合作生产': ['合作生产', '联合开发']
        }
    
    def filter_by_tech_field(self, demand: Dict[str, Any], 
                           achievements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        demand_field = demand.get('tech_field', '通用技术')
        compatible_fields = self.tech_field_compatibility.get(demand_field, ['通用技术'])
        
        filtered = [
            achievement for achievement in achievements
            if achievement.get('tech_field', '通用技术') in compatible_fields
        ]
        
        return filtered
    
    def filter_by_trl_level(self, demand: Dict[str, Any], 
                           achievements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        demand_trl = demand.get('trl_level', 5)
        trl_req = self.trl_requirements.get(demand_trl, {'min_trl': 3, 'max_trl': 9})
        
        min_trl = trl_req['min_trl']
        max_trl = trl_req['max_trl']
        
        filtered = [
            achievement for achievement in achievements
            if min_trl <= achievement.get('trl_level', 3) <= max_trl
        ]
        
        return filtered
    
    def filter_by_ip_status(self, achievements: List[Dict[str, Any]], 
                          require_patent: bool = True) -> List[Dict[str, Any]]:
        if not require_patent:
            return achievements
        
        filtered = [
            achievement for achievement in achievements
            if achievement.get('patent_number', '') or achievement.get('transferable', False)
        ]
        
        return filtered
    
    def filter_by_region(self, demand: Dict[str, Any], 
                       achievements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        demand_region = demand.get('region', '全国')
        priority_regions = self.region_priorities.get(demand_region, ['全国'])
        
        filtered = []
        for achievement in achievements:
            achievement_region = achievement.get('region', '全国')
            if achievement_region in priority_regions:
                filtered.append(achievement)
        
        return filtered
    
    def filter_by_cooperation_mode(self, demand: Dict[str, Any], 
                                  achievements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        demand_modes = demand.get('cooperation_modes', ['技术转让'])
        
        filtered = []
        for achievement in achievements:
            achievement_modes = achievement.get('cooperation_modes', ['技术转让'])
            
            compatible = False
            for demand_mode in demand_modes:
                compatible_modes = self.cooperation_mode_compatibility.get(demand_mode, [demand_mode])
                if any(mode in achievement_modes for mode in compatible_modes):
                    compatible = True
                    break
            
            if compatible:
                filtered.append(achievement)
        
        return filtered
    
    def filter_by_budget(self, demand: Dict[str, Any], 
                       achievements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        demand_budget = demand.get('budget_range', (0, 0))
        min_budget, max_budget = demand_budget
        
        if max_budget == 0:
            return achievements
        
        filtered = []
        for achievement in achievements:
            achievement_cost = achievement.get('estimated_cost', 0)
            if achievement_cost <= max_budget and achievement_cost >= min_budget:
                filtered.append(achievement)
        
        return filtered
    
    def apply_all_constraints(self, demand: Dict[str, Any], 
                            achievements: List[Dict[str, Any]],
                            constraints: Optional[Dict[str, bool]] = None) -> List[Dict[str, Any]]:
        if constraints is None:
            constraints = {
                'tech_field': True,
                'trl_level': True,
                'ip_status': True,
                'region': True,
                'cooperation_mode': True,
                'budget': False
            }
        
        filtered = achievements
        
        if constraints.get('tech_field', True):
            filtered = self.filter_by_tech_field(demand, filtered)
        
        if constraints.get('trl_level', True):
            filtered = self.filter_by_trl_level(demand, filtered)
        
        if constraints.get('ip_status', True):
            filtered = self.filter_by_ip_status(filtered)
        
        if constraints.get('region', True):
            filtered = self.filter_by_region(demand, filtered)
        
        if constraints.get('cooperation_mode', True):
            filtered = self.filter_by_cooperation_mode(demand, filtered)
        
        if constraints.get('budget', False):
            filtered = self.filter_by_budget(demand, filtered)
        
        return filtered
    
    def rank_by_constraints(self, demand: Dict[str, Any], 
                          achievements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        scored_achievements = []
        
        for achievement in achievements:
            score = 0
            reasons = []
            
            if achievement.get('tech_field') == demand.get('tech_field'):
                score += 0.25
                reasons.append('技术领域完全匹配')
            
            demand_trl = demand.get('trl_level', 5)
            achievement_trl = achievement.get('trl_level', 3)
            trl_diff = abs(demand_trl - achievement_trl)
            if trl_diff <= 1:
                score += 0.25
                reasons.append('TRL成熟度高度匹配')
            elif trl_diff <= 2:
                score += 0.15
                reasons.append('TRL成熟度基本匹配')
            
            if achievement.get('patent_number'):
                score += 0.15
                reasons.append('拥有专利保护')
            
            if achievement.get('transferable'):
                score += 0.15
                reasons.append('可转让状态良好')
            
            demand_region = demand.get('region', '全国')
            achievement_region = achievement.get('region', '全国')
            if demand_region == achievement_region:
                score += 0.10
                reasons.append('地域协同优势')
            
            demand_modes = set(demand.get('cooperation_modes', []))
            achievement_modes = set(achievement.get('cooperation_modes', []))
            if demand_modes & achievement_modes:
                score += 0.10
                reasons.append('合作模式兼容')
            
            scored_achievements.append({
                **achievement,
                'constraint_score': score,
                'constraint_reasons': reasons
            })
        
        ranked = sorted(scored_achievements, key=lambda x: x['constraint_score'], reverse=True)
        return ranked
    
    def explain_filtering(self, demand: Dict[str, Any], 
                       filtered_count: int, original_count: int) -> str:
        explanation = f"规则约束过滤结果：从 {original_count} 个候选中筛选出 {filtered_count} 个\n"
        explanation += f"筛选率：{filtered_count/original_count*100:.1f}%\n"
        
        demand_field = demand.get('tech_field', '未知')
        demand_trl = demand.get('trl_level', 5)
        
        explanation += f"\n主要约束条件：\n"
        explanation += f"- 技术领域：{demand_field}\n"
        explanation += f"- TRL成熟度：{demand_trl} ({self.trl_requirements.get(demand_trl, {}).get('description', '未知')})\n"
        explanation += f"- 地域要求：{demand.get('region', '全国')}\n"
        explanation += f"- 合作模式：{', '.join(demand.get('cooperation_modes', ['技术转让']))}\n"
        
        return explanation
    
    def custom_filter(self, achievements: List[Dict[str, Any]], 
                    filter_func: Callable[[Dict[str, Any]], bool]) -> List[Dict[str, Any]]:
        return [achievement for achievement in achievements if filter_func(achievement)]
    
    def batch_filter(self, demands: List[Dict[str, Any]], 
                   achievements: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        results = {}
        
        for demand in demands:
            demand_id = demand.get('id', 'unknown')
            filtered = self.apply_all_constraints(demand, achievements)
            ranked = self.rank_by_constraints(demand, filtered)
            results[demand_id] = ranked
        
        return results
    
    def get_constraint_stats(self, demand: Dict[str, Any], 
                          achievements: List[Dict[str, Any]]) -> Dict[str, Any]:
        original_count = len(achievements)
        
        tech_field_filtered = self.filter_by_tech_field(demand, achievements)
        trl_filtered = self.filter_by_trl_level(demand, tech_field_filtered)
        ip_filtered = self.filter_by_ip_status(trl_filtered)
        region_filtered = self.filter_by_region(demand, ip_filtered)
        mode_filtered = self.filter_by_cooperation_mode(demand, region_filtered)
        
        stats = {
            'original_count': original_count,
            'tech_field_filtered': len(tech_field_filtered),
            'trl_filtered': len(trl_filtered),
            'ip_filtered': len(ip_filtered),
            'region_filtered': len(region_filtered),
            'mode_filtered': len(mode_filtered),
            'final_count': len(mode_filtered)
        }
        
        return stats

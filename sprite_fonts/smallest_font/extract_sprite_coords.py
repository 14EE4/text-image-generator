import json
from PIL import Image
import numpy as np

def find_glyph_bounds(img_array, start_x, max_width, height):
    """
    start_x부터 시작해서 첫 번째 글자의 바운딩 박스를 찾습니다.
    Returns: (sx, sy, w, h, next_start_x) 또는 None
    """
    # 알파 채널이 0이 아닌 픽셀 찾기
    h, w = img_array.shape[:2]
    
    # start_x부터 오른쪽으로 스캔하면서 첫 픽셀 찾기
    left = None
    for x in range(start_x, min(start_x + max_width, w)):
        if np.any(img_array[:, x, 3] > 0):  # 알파 > 0인 픽셀이 있으면
            left = x
            break
    
    if left is None:
        return None
    
    # 오른쪽 경계 찾기 - 픽셀이 있는 마지막 열 찾기
    right = left
    for x in range(left, min(start_x + max_width, w)):
        if np.any(img_array[:, x, 3] > 0):
            right = x  # 픽셀이 있는 열 업데이트
        else:
            # 빈 픽셀 만나면 종료 (right는 마지막 픽셀 위치 유지)
            break
    
    return {
        'sx': int(left),
        'sy': 0,  # 고정
        'w': int(right - left + 1),  # 정확한 너비
        'h': 5,   # 고정
        'next_x': int(right + 1)
    }

def extract_coords_from_sprite(image_path, char_order, output_path='smallest_coords.json'):
    """
    스프라이트 이미지에서 자동으로 글자 오프셋을 추출합니다.
    
    Args:
        image_path: 스프라이트 이미지 경로
        char_order: 글자 순서 문자열 (예: "AaBbCc...")
        output_path: 출력 JSON 경로
    """
    # 이미지 로드
    img = Image.open(image_path).convert('RGBA')
    img_array = np.array(img)
    height, width = img_array.shape[:2]
    
    print(f"이미지 크기: {width}x{height}")
    print(f"처리할 문자 수: {len(char_order)}")
    print(f"{'Index':<6} {'Char':<6} {'X':<6} {'Width':<6}")
    print("-" * 30)
    
    coords = []
    current_x = 0
    max_char_width = 10  # 최대 글자 폭을 10픽셀로 제한
    
    for i, char in enumerate(char_order):
        result = find_glyph_bounds(img_array, current_x, max_char_width, height)
        
        if result is None:
            print(f"{i:<6} '{char}'    {current_x:<6} 3      ⚠️  픽셀 없음")
            coords.append({
                'char': char,
                'index': i,
                'sx': current_x,
                'sy': 0,
                'w': 1,  # 기본 너비를 1로 변경
                'h': 5
            })
            current_x += 2  # 기본 간격 2픽셀 (글자 1 + 간격 1)
        else:
            print(f"{i:<6} '{char}'    {result['sx']:<6} {result['w']}")
            coords.append({
                'char': char,
                'index': i,
                'sx': result['sx'],
                'sy': 0,
                'w': result['w'],
                'h': 5
            })
            current_x = result['next_x'] + 1  # 1픽셀 간격 추가
    
    # JSON 생성
    output = {
        'meta': {
            'image': image_path,
            'imageWidth': width,
            'imageHeight': height,
            'charCount': len(coords),
            'order': char_order
        },
        'coords': coords
    }
    
    # 저장
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ {output_path} 생성 완료!")
    print(f"   총 {len(coords)}개 글자 처리됨")

if __name__ == '__main__':
    # smallest-font.png 처리
    IMAGE_PATH = './smallest-font.png'
    CHAR_ORDER = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz'
    
    extract_coords_from_sprite(IMAGE_PATH, CHAR_ORDER, 'smallest_coords.json')
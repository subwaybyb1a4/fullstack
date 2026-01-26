from app.services.fast_transfer_service import FastTransferService
import sys
 
def verify():
    print("Initializing FastTransferService...")
    service = FastTransferService()
    
    if service.df is None:
        print("Failed to load DataFrame.")
        return

    print(f"Loaded {len(service.df)} records.")
    print("Columns:", service.df.columns.tolist())
    
    # Try multiple common transfers to see if we get a hit
    test_cases = [
        ("사당", "4호선", "2호선"),
        ("사당", "2호선", "4호선"),
        ("가락시장", "3호선", "8호선"), # Based on '송파'(8호선 nearby?) and '3' in sample
        ("고속터미널", "3호선", "7호선"),
        ("고속터미널", "3호선", "9호선"),
        ("서울역", "1호선", "4호선"),
        ("서울역", "4호선", "1호선")
    ]
    
    print("\nTesting lookups:")
    for station, f_line, t_line in test_cases:
        res = service.get_fast_transfer(station, "dummy_id", f_line, t_line)
        print(f"Transfer at {station} ({f_line}->{t_line}): {res}")
        
    # Also print first few rows to debug if needed
    print("\nFirst 3 rows:")
    print(service.df[['환승역', '환승전호선', '환승후호선', '차량번호', '출입문위치']].head(3))

if __name__ == "__main__":
    verify()

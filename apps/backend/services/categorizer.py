import re


class TransactionCategorizer:
    _RULES = [
        (
            re.compile(
                r'nasgor|warteg|watteg|goren|kopi|makan|resto|warung|cafe|kedai|'
                r'mie|bakso|soto|nasi|burger|pizza|kfc|mcd|starbucks|jollibee|'
                r'richeese|hokben|yoshinoya|padang|sunda|bakmi|dim.?sum|sushi|ramen|'
                r'sarapan|beverage|food|rumah.?makan|kantin|catering|boba|es.?teh|'
                r'geprek|ayam|seafood|bebek|fried|chicken',
                re.I,
            ),
            'food_and_beverage',
        ),
        (
            re.compile(
                r'alfamart|indomaret|superindo|giant|carrefour|hypermart|hero|'
                r'lawson|circle.?k|7.?eleven|minimarket|kelontong|sembako|toserba|'
                r'swalayan|fresh.?mart|farmers|grocer',
                re.I,
            ),
            'groceries',
        ),
        (
            re.compile(
                r'tokoped|tokopedia|shopee|lazada|bukalapak|blibli|jd\.id|'
                r'tiktok.?shop|olshop|online.?shop|belanja|amazon|zalora|berrybenka|'
                r'sociolla|orami|bhinneka',
                re.I,
            ),
            'shopping',
        ),
        (
            re.compile(
                r'bi.?fast|ajaib|bibit|reksadana|investasi|saham|crypto|bitcoin|'
                r'flip|jenius|deposito|cicilan|installment|angsuran|'
                r'transfer|kirim.?uang|setoran|tarik.?tunai|atm|setor',
                re.I,
            ),
            'transfer_investment',
        ),
        (
            re.compile(
                r'gojek|grab|ojek|taxi|busway|mrt|lrt|commuter|krl|parkir|'
                r'\btol\b|bensin|pertamina|spbu|bbm|bahan.?bakar|shell|vivo.?gas|'
                r'blue.?bird|maxim|indriver|transjakarta',
                re.I,
            ),
            'transport',
        ),
        (
            re.compile(
                r'\bpln\b|pdam|listrik|telkom|telkomsel|\bxl\b|indosat|\btri\b|axis|'
                r'internet|wifi|speedy|indihome|firstmedia|token.?listrik|pulsa|kuota|'
                r'tagihan|utilit',
                re.I,
            ),
            'utilities',
        ),
        (
            re.compile(
                r'netflix|spotify|youtube|disney|vidio|viu|hbo|game|hiburan|'
                r'bioskop|cgv|cinema|iflix|deezer|apple.?music|steam|playstation|'
                r'nintendo|xbox|twitch|prime.?video',
                re.I,
            ),
            'lifestyle',
        ),
        (
            re.compile(
                r'apotek|apotik|kimia.?farma|guardian|watsons|klinik|dokter|'
                r'rumah.?sakit|\brs\b|\brsu\b|puskesmas|\bbpjs\b|asuransi|'
                r'\bobat\b|vitamin|kesehatan|dental|optik|laborator',
                re.I,
            ),
            'healthcare',
        ),
        (
            re.compile(
                r'hotel|airbnb|booking\.com|traveloka|tiket\.com|agoda|pesawat|'
                r'lion.?air|garuda|citilink|airasia|kereta.?api|travel|wisata|villa',
                re.I,
            ),
            'travel',
        ),
    ]

    @staticmethod
    def predict_category(description: str) -> str:
        for pattern, category in TransactionCategorizer._RULES:
            if pattern.search(description):
                return category
        return 'uncategorized'

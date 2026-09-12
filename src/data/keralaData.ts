import { Alliance, Party, Person, Constituency } from '../types';

export const alliancesData: Alliance[] = [
  {
    id: 'ldf',
    name: 'Left Democratic Front',
    abbreviation: 'LDF',
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=LDF',
    colors: ['#D32F2F', '#1a1a1a'],
    founderId: 'pinarayi-vijayan',
    chairmanId: 'pinarayi-vijayan',
    leaderId: 'pinarayi-vijayan',
    foundedDate: '1980-01-01',
    leadingPartyId: 'cpim',
    updatedAt: Date.now()
  },
  {
    id: 'udf',
    name: 'United Democratic Front',
    abbreviation: 'UDF',
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=UDF',
    colors: ['#1E3A8A', '#2563EB'],
    founderId: 'v-d-satheesan',
    chairmanId: 'k-sudhakaran',
    leaderId: 'v-d-satheesan',
    foundedDate: '1978-07-01',
    leadingPartyId: 'inc',
    updatedAt: Date.now()
  },
  {
    id: 'nda',
    name: 'National Democratic Alliance',
    abbreviation: 'NDA',
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=NDA',
    colors: ['#EA580C', '#F97316'],
    founderId: 'k-surendran',
    chairmanId: 'k-surendran',
    leaderId: 'k-surendran',
    foundedDate: '1998-05-01',
    leadingPartyId: 'bjp',
    updatedAt: Date.now()
  }
];

export const partiesData: Party[] = [
  {
    id: 'cpim',
    name: 'Communist Party of India (Marxist)',
    abbreviation: 'CPI(M)',
    allianceId: 'ldf',
    colors: ['#E11D48'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=CPIM',
    founded: '1964-11-07',
    chairman: 'M. V. Govindan',
    headquarters: 'AKG Centre, Thiruvananthapuram',
    updatedAt: Date.now()
  },
  {
    id: 'cpi',
    name: 'Communist Party of India',
    abbreviation: 'CPI',
    allianceId: 'ldf',
    colors: ['#EF4444'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=CPI',
    founded: '1925-12-26',
    chairman: 'Binoy Viswam',
    headquarters: 'MN Smarakam, Thiruvananthapuram',
    updatedAt: Date.now()
  },
  {
    id: 'inc',
    name: 'Indian National Congress',
    abbreviation: 'INC',
    allianceId: 'udf',
    colors: ['#2563EB'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=INC',
    founded: '1885-12-28',
    chairman: 'K. Sudhakaran',
    headquarters: 'Indira Bhavan, Thiruvananthapuram',
    updatedAt: Date.now()
  },
  {
    id: 'iuml',
    name: 'Indian Union Muslim League',
    abbreviation: 'IUML',
    allianceId: 'udf',
    colors: ['#10B981'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=IUML',
    founded: '1948-03-10',
    chairman: 'Panakkad Sadiq Ali Thangal',
    headquarters: 'Grace House, Kozhikode',
    updatedAt: Date.now()
  },
  {
    id: 'kcm',
    name: 'Kerala Congress (M)',
    abbreviation: 'KC(M)',
    allianceId: 'ldf',
    colors: ['#EC4899'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=KCM',
    founded: '1979-10-09',
    chairman: 'Jose K. Mani',
    headquarters: 'State Committee Office, Kottayam',
    updatedAt: Date.now()
  },
  {
    id: 'bjp',
    name: 'Bharatiya Janata Party',
    abbreviation: 'BJP',
    allianceId: 'nda',
    colors: ['#EA580C'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=BJP',
    founded: '1980-04-06',
    chairman: 'K. Surendran',
    headquarters: 'K. G. Marar Bhavan, Thiruvananthapuram',
    updatedAt: Date.now()
  },
  {
    id: 'ncp',
    name: 'Nationalist Congress Party',
    abbreviation: 'NCP',
    allianceId: 'ldf',
    colors: ['#059669'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=NCP',
    founded: '1999-06-10',
    chairman: 'P. C. Chacko',
    headquarters: 'NCP Office, Thiruvananthapuram',
    updatedAt: Date.now()
  },
  {
    id: 'jds',
    name: 'Janata Dal (Secular)',
    abbreviation: 'JD(S)',
    allianceId: 'ldf',
    colors: ['#16A34A'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=JDS',
    founded: '1999-07-13',
    chairman: 'Mathew T. Thomas',
    headquarters: 'JDS State Head Office, Thiruvananthapuram',
    updatedAt: Date.now()
  },
  {
    id: 'rmpi',
    name: 'Revolutionary Marxist Party of India',
    abbreviation: 'RMPI',
    allianceId: 'udf',
    colors: ['#DC2626'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=RMPI',
    founded: '2016-10-21',
    chairman: 'T. L. Santhosh',
    headquarters: 'Onchiyam, Kozhikode',
    updatedAt: Date.now()
  },
  {
    id: 'kc',
    name: 'Kerala Congress',
    abbreviation: 'KC',
    allianceId: 'udf',
    colors: ['#2563EB'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=KC',
    founded: '1964-10-09',
    chairman: 'P. J. Joseph',
    headquarters: 'Thodupuzha, Idukki',
    updatedAt: Date.now()
  },
  {
    id: 'independent',
    name: 'Independent',
    abbreviation: 'IND',
    allianceId: 'independent',
    colors: ['#4b5563'],
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=IND',
    founded: '1950-01-01',
    chairman: 'None',
    headquarters: 'None',
    updatedAt: Date.now()
  }
];

export const rawMLAs = [
  { slNo: '001', name: 'A. K. M. Ashraf', gender: 'Male', partyId: 'iuml', constituency: 'Manjeshwar' },
  { slNo: '002', name: 'N. A. Nellikkunnu', gender: 'Male', partyId: 'iuml', constituency: 'Kasaragod' },
  { slNo: '003', name: 'C. H. Kunhambu', gender: 'Male', partyId: 'cpim', constituency: 'Udma' },
  { slNo: '004', name: 'E. Chandrasekharan', gender: 'Male', partyId: 'cpi', constituency: 'Kanhangad' },
  { slNo: '005', name: 'M. Rajagopalan', gender: 'Male', partyId: 'cpim', constituency: 'Trikaripur' },
  { slNo: '006', name: 'T. I. Madhusoodanan', gender: 'Male', partyId: 'cpim', constituency: 'Payyanur' },
  { slNo: '007', name: 'M. Vijin', gender: 'Male', partyId: 'cpim', constituency: 'Kalliasseri' },
  { slNo: '008', name: 'M. V. Govindan', gender: 'Male', partyId: 'cpim', constituency: 'Taliparamba', role: 'Party State Secretary' },
  { slNo: '009', name: 'Sajeev Joseph', gender: 'Male', partyId: 'inc', constituency: 'Irikkur' },
  { slNo: '010', name: 'K. V. Sumesh', gender: 'Male', partyId: 'cpim', constituency: 'Azhikode' },
  { slNo: '011', name: 'Kadannappalli Ramachandran', gender: 'Male', partyId: 'cpim', constituency: 'Kannur', role: 'Minister for Registration & Museum' },
  { slNo: '012', name: 'Pinarayi Vijayan', gender: 'Male', partyId: 'cpim', constituency: 'Dharmadom', role: 'Chief Minister' },
  { slNo: '013', name: 'A. N. Shamseer', gender: 'Male', partyId: 'cpim', constituency: 'Thalassery', role: 'Speaker' },
  { slNo: '014', name: 'K. P. Mohanan', gender: 'Male', partyId: 'ind', constituency: 'Kuthuparamba' },
  { slNo: '015', name: 'K. K. Shailaja', gender: 'Female', partyId: 'cpim', constituency: 'Mattannur', role: 'Former Health Minister' },
  { slNo: '016', name: 'Sunny Joseph', gender: 'Male', partyId: 'inc', constituency: 'Peravoor' },
  { slNo: '017', name: 'O. R. Kelu', gender: 'Male', partyId: 'cpim', constituency: 'Mananthavady', role: 'Minister for SC/ST Development' },
  { slNo: '018', name: 'I. C. Balakrishnan', gender: 'Male', partyId: 'inc', constituency: 'Sulthan Bathery' },
  { slNo: '019', name: 'T. Siddique', gender: 'Male', partyId: 'inc', constituency: 'Kalpetta', role: 'KPCC Vice President' },
  { slNo: '020', name: 'K. K. Rema', gender: 'Female', partyId: 'rmpi', constituency: 'Vadakara' },
  { slNo: '021', name: 'K. P. Kunhammed Kutty', gender: 'Male', partyId: 'cpim', constituency: 'Kuttiady' },
  { slNo: '022', name: 'E. K. Vijayan', gender: 'Male', partyId: 'cpi', constituency: 'Nadapuram' },
  { slNo: '023', name: 'Kanathil Jameela', gender: 'Female', partyId: 'cpim', constituency: 'Koyilandy' },
  { slNo: '024', name: 'T. P. Ramakrishnan', gender: 'Male', partyId: 'cpim', constituency: 'Perambra' },
  { slNo: '025', name: 'K. M. Sachin Dev', gender: 'Male', partyId: 'cpim', constituency: 'Balussery' },
  { slNo: '026', name: 'A. K. Saseendran', gender: 'Male', partyId: 'ncp', constituency: 'Elathur', role: 'Minister for Forest & Wildlife' },
  { slNo: '027', name: 'Thottathil Raveendran', gender: 'Male', partyId: 'cpim', constituency: 'Kozhikode North' },
  { slNo: '028', name: 'Ahmed Devarkovil', gender: 'Male', partyId: 'ind', constituency: 'Kozhikode South' },
  { slNo: '029', name: 'P. A. Mohamed Riyas', gender: 'Male', partyId: 'cpim', constituency: 'Beypore', role: 'Minister for PWD & Tourism' },
  { slNo: '030', name: 'P. T. A. Rahim', gender: 'Male', partyId: 'independent', constituency: 'Kunnamangalam' },
  { slNo: '031', name: 'M. K. Muneer', gender: 'Male', partyId: 'iuml', constituency: 'Koduvally', role: 'Former Minister' },
  { slNo: '032', name: 'Linto Joseph', gender: 'Male', partyId: 'cpim', constituency: 'Thiruvambady' },
  { slNo: '033', name: 'T. V. Ibrahim', gender: 'Male', partyId: 'iuml', constituency: 'Kondotty' },
  { slNo: '034', name: 'P. K. Basheer', gender: 'Male', partyId: 'iuml', constituency: 'Eranad' },
  { slNo: '035', name: 'P. V. Anvar', gender: 'Male', partyId: 'independent', constituency: 'Nilambur' },
  { slNo: '036', name: 'A. P. Anil Kumar', gender: 'Male', partyId: 'inc', constituency: 'Wandoor' },
  { slNo: '037', name: 'U. A. Latheef', gender: 'Male', partyId: 'iuml', constituency: 'Manjeri' },
  { slNo: '038', name: 'Najeeb Kanthapuram', gender: 'Male', partyId: 'iuml', constituency: 'Perinthalmanna' },
  { slNo: '039', name: 'Manjalamkuzhi Ali', gender: 'Male', partyId: 'iuml', constituency: 'Mankada' },
  { slNo: '040', name: 'P. Ubaidulla', gender: 'Male', partyId: 'iuml', constituency: 'Malappuram' },
  { slNo: '041', name: 'P. K. Kunhalikutty', gender: 'Male', partyId: 'iuml', constituency: 'Vengara', role: 'Opposition Deputy Leader' },
  { slNo: '042', name: 'P. Abdul Hameed', gender: 'Male', partyId: 'iuml', constituency: 'Vallikkunnu' },
  { slNo: '043', name: 'K. P. A. Majeed', gender: 'Male', partyId: 'iuml', constituency: 'Tirurangadi' },
  { slNo: '044', name: 'V. Abdurahiman', gender: 'Male', partyId: 'cpim', constituency: 'Tanur', role: 'Minister for Sports & Wakf' },
  { slNo: '045', name: 'Kurukkoli Moideen', gender: 'Male', partyId: 'iuml', constituency: 'Tirur' },
  { slNo: '046', name: 'K. K. Abid Hussain Thangal', gender: 'Male', partyId: 'iuml', constituency: 'Kottakkal' },
  { slNo: '047', name: 'K. T. Jaleel', gender: 'Male', partyId: 'independent', constituency: 'Thavanur', role: 'Former Higher Edu Minister' },
  { slNo: '048', name: 'P. Nandakumar', gender: 'Male', partyId: 'cpim', constituency: 'Ponnani' },
  { slNo: '049', name: 'M. B. Rajesh', gender: 'Male', partyId: 'cpim', constituency: 'Thrithala', role: 'Minister for Local Self Governments' },
  { slNo: '050', name: 'Muhammed Muhsin', gender: 'Male', partyId: 'cpi', constituency: 'Pattambi' },
  { slNo: '051', name: 'P. Mammikutty', gender: 'Male', partyId: 'cpim', constituency: 'Shoranur' },
  { slNo: '052', name: 'K. Premkumar', gender: 'Male', partyId: 'cpim', constituency: 'Ottapalam' },
  { slNo: '053', name: 'K. Shanthakumari', gender: 'Female', partyId: 'cpim', constituency: 'Kongad' },
  { slNo: '054', name: 'N. Samsudheen', gender: 'Male', partyId: 'iuml', constituency: 'Mannarkkad' },
  { slNo: '055', name: 'A. Prabhakaran', gender: 'Male', partyId: 'cpim', constituency: 'Malampuzha' },
  { slNo: '056', name: 'Rahul Mamkootathil', gender: 'Male', partyId: 'inc', constituency: 'Palakkad', role: 'Youth Congress State President' },
  { slNo: '057', name: 'P. P. Sumod', gender: 'Male', partyId: 'cpim', constituency: 'Tarur' },
  { slNo: '058', name: 'K. Krishnankutty', gender: 'Male', partyId: 'jds', constituency: 'Chittur', role: 'Minister for Electricity' },
  { slNo: '059', name: 'K. Babu (Nenmara)', gender: 'Male', partyId: 'cpim', constituency: 'Nenmara' },
  { slNo: '060', name: 'K. D. Prasenan', gender: 'Male', partyId: 'cpim', constituency: 'Alathur' },
  { slNo: '061', name: 'U. R. Pradeep', gender: 'Male', partyId: 'cpim', constituency: 'Chelakkara' },
  { slNo: '062', name: 'A. C. Moideen', gender: 'Male', partyId: 'cpim', constituency: 'Kunnamkulam', role: 'Former CM & LSG Minister' },
  { slNo: '063', name: 'N. K. Akbar', gender: 'Male', partyId: 'cpim', constituency: 'Guruvayur' },
  { slNo: '064', name: 'Murali Perunelly', gender: 'Male', partyId: 'cpim', constituency: 'Manalur' },
  { slNo: '065', name: 'Xavier Chittilappilly', gender: 'Male', partyId: 'cpim', constituency: 'Wadakkanchery' },
  { slNo: '066', name: 'K. Rajan', gender: 'Male', partyId: 'cpi', constituency: 'Ollur', role: 'Minister for Revenue' },
  { slNo: '067', name: 'P. Balachandran', gender: 'Male', partyId: 'cpi', constituency: 'Thrissur' },
  { slNo: '068', name: 'C. C. Mukundan', gender: 'Male', partyId: 'cpi', constituency: 'Nattika' },
  { slNo: '069', name: 'E. T. Tyson', gender: 'Male', partyId: 'cpi', constituency: 'Kaipamangalam' },
  { slNo: '070', name: 'R. Bindu', gender: 'Female', partyId: 'cpim', constituency: 'Irinjalakuda', role: 'Minister for Higher Education' },
  { slNo: '071', name: 'K. K. Ramachandran', gender: 'Male', partyId: 'cpim', constituency: 'Puthukkad' },
  { slNo: '072', name: 'T. J. Saneesh Kumar Joseph', gender: 'Male', partyId: 'inc', constituency: 'Chalakudy' },
  { slNo: '073', name: 'V. R. Sunil Kumar', gender: 'Male', partyId: 'cpi', constituency: 'Kodungallur' },
  { slNo: '074', name: 'Eldhose Kunnappilly', gender: 'Male', partyId: 'inc', constituency: 'Perumbavoor' },
  { slNo: '075', name: 'Roji M. John', gender: 'Male', partyId: 'inc', constituency: 'Angamaly' },
  { slNo: '076', name: 'Anwar Sadath', gender: 'Male', partyId: 'inc', constituency: 'Aluva' },
  { slNo: '077', name: 'P. Rajeev', gender: 'Male', partyId: 'cpim', constituency: 'Kalamassery', role: 'Minister for Industries & Law' },
  { slNo: '078', name: 'V. D. Satheesan', gender: 'Male', partyId: 'inc', constituency: 'Paravur', role: 'Leader of Opposition' },
  { slNo: '079', name: 'K. N. Unnikrishnan', gender: 'Male', partyId: 'cpim', constituency: 'Vypin' },
  { slNo: '080', name: 'K. J. Maxi', gender: 'Male', partyId: 'cpim', constituency: 'Kochi' },
  { slNo: '081', name: 'K. Babu', gender: 'Male', partyId: 'inc', constituency: 'Thrippunithura', role: 'Former Excise Minister' },
  { slNo: '082', name: 'T. J. Vinod', gender: 'Male', partyId: 'inc', constituency: 'Ernakulam' },
  { slNo: '083', name: 'Uma Thomas', gender: 'Female', partyId: 'inc', constituency: 'Thrikkakara' },
  { slNo: '084', name: 'P. V. Sreejin', gender: 'Male', partyId: 'cpim', constituency: 'Kunnathunad' },
  { slNo: '085', name: 'Anoop Jacob', gender: 'Male', partyId: 'kc', constituency: 'Piravom' },
  { slNo: '086', name: 'Mathew Kuzhalnadan', gender: 'Male', partyId: 'inc', constituency: 'Muvattupuzha', role: 'Congress Youth leader & Lawyer' },
  { slNo: '087', name: 'Antony John', gender: 'Male', partyId: 'cpim', constituency: 'Kothamangalam' },
  { slNo: '088', name: 'A. Raja', gender: 'Male', partyId: 'cpim', constituency: 'Devikulam' },
  { slNo: '089', name: 'M. M. Mani', gender: 'Male', partyId: 'cpim', constituency: 'Udumbanchola', role: 'Popular Veteran Hill Leader' },
  { slNo: '090', name: 'P. J. Joseph', gender: 'Male', partyId: 'kc', constituency: 'Thodupuzha', role: 'Party Leader' },
  { slNo: '091', name: 'Roshy Augustine', gender: 'Male', partyId: 'kcm', constituency: 'Idukki', role: 'Minister for Water Resources' },
  { slNo: '092', name: 'Vazhoor Soman', gender: 'Male', partyId: 'cpi', constituency: 'Peerumade' },
  { slNo: '093', name: 'Mani C. Kappan', gender: 'Male', partyId: 'independent', constituency: 'Pala' },
  { slNo: '094', name: 'Mons Joseph', gender: 'Male', partyId: 'kc', constituency: 'Kaduthuruthy' },
  { slNo: '095', name: 'C. K. Asha', gender: 'Female', partyId: 'cpi', constituency: 'Vaikom' },
  { slNo: '096', name: 'V. N. Vasavan', gender: 'Male', partyId: 'cpim', constituency: 'Ettumanoor', role: 'Minister for Co-operation & Ports' },
  { slNo: '097', name: 'Thiruvanchoor Radhakrishnan', gender: 'Male', partyId: 'inc', constituency: 'Kottayam', role: 'Former Home Minister' },
  { slNo: '098', name: 'Chandy Oommen', gender: 'Male', partyId: 'inc', constituency: 'Puthuppally' },
  { slNo: '099', name: 'Job Michael', gender: 'Male', partyId: 'kcm', constituency: 'Changanassery' },
  { slNo: '100', name: 'N. Jayaraj', gender: 'Male', partyId: 'kcm', constituency: 'Kanjirappally', role: 'Government Chief Whip' },
  { slNo: '101', name: 'Sebastian Kulathunkal', gender: 'Male', partyId: 'kcm', constituency: 'Poonjar' },
  { slNo: '102', name: 'Daleema Jojo', gender: 'Female', partyId: 'cpim', constituency: 'Aroor', role: 'Playback Singer' },
  { slNo: '103', name: 'P. Prasad', gender: 'Male', partyId: 'cpi', constituency: 'Cherthala', role: 'Minister for Agriculture' },
  { slNo: '104', name: 'P. P. Chitharanjan', gender: 'Male', partyId: 'cpim', constituency: 'Alappuzha' },
  { slNo: '105', name: 'H. Salam', gender: 'Male', partyId: 'cpim', constituency: 'Ambalappuzha' },
  { slNo: '106', name: 'Ramesh Chennithala', gender: 'Male', partyId: 'inc', constituency: 'Haripad', role: 'Former Leader of Opposition' },
  { slNo: '107', name: 'U. Prathibha', gender: 'Female', partyId: 'cpim', constituency: 'Kayamkulam' },
  { slNo: '108', name: 'M. S. Arun Kumar', gender: 'Male', partyId: 'cpim', constituency: 'Mavelikara' },
  { slNo: '109', name: 'Saji Cherian', gender: 'Male', partyId: 'cpim', constituency: 'Chengannur', role: 'Minister for Fisheries & Culture' },
  { slNo: '110', name: 'Thomas K. Thomas', gender: 'Male', partyId: 'ncp', constituency: 'Kuttanad' },
  { slNo: '111', name: 'Mathew T. Thomas', gender: 'Male', partyId: 'jds', constituency: 'Thiruvalla', role: 'Former JDS Minister' },
  { slNo: '112', name: 'Pramod Narayan', gender: 'Male', partyId: 'kcm', constituency: 'Ranni' },
  { slNo: '113', name: 'Veena George', gender: 'Female', partyId: 'cpim', constituency: 'Aranmula', role: 'Minister for Health' },
  { slNo: '114', name: 'K. U. Jenish Kumar', gender: 'Male', partyId: 'cpim', constituency: 'Konni' },
  { slNo: '115', name: 'Chittayam Gopakumar', gender: 'Male', partyId: 'cpi', constituency: 'Adoor', role: 'Deputy Speaker' },
  { slNo: '116', name: 'C. R. Mahesh', gender: 'Male', partyId: 'inc', constituency: 'Karunagappally' },
  { slNo: '117', name: 'Sujith Vijayan Pillai', gender: 'Male', partyId: 'independent', constituency: 'Chavara' },
  { slNo: '118', name: 'Kovoor Kunjumon', gender: 'Male', partyId: 'independent', constituency: 'Kunnathur' },
  { slNo: '119', name: 'K. N. Balagopal', gender: 'Male', partyId: 'cpim', constituency: 'Kottarakara', role: 'Minister for Finance' },
  { slNo: '120', name: 'K. B. Ganesh Kumar', gender: 'Male', partyId: 'cpim', constituency: 'Pathanapuram', role: 'Minister for Transport & Actor' },
  { slNo: '121', name: 'P. S. Supal', gender: 'Male', partyId: 'cpi', constituency: 'Punalur' },
  { slNo: '122', name: 'J. Chinchu Rani', gender: 'Female', partyId: 'cpi', constituency: 'Chadayamangalam', role: 'Minister for Animal Husbandry' },
  { slNo: '123', name: 'P. C. Vishnunadh', gender: 'Male', partyId: 'inc', constituency: 'Kundara' },
  { slNo: '124', name: 'M. Mukesh', gender: 'Male', partyId: 'cpim', constituency: 'Kollam', role: 'MLA & Popular Actor' },
  { slNo: '125', name: 'M. Noushad', gender: 'Male', partyId: 'cpim', constituency: 'Eravipuram' },
  { slNo: '126', name: 'G. S. Jayalal', gender: 'Male', partyId: 'cpi', constituency: 'Chathannoor' },
  { slNo: '127', name: 'V. Joy', gender: 'Male', partyId: 'cpim', constituency: 'Varkala', role: 'CPM District Secretary' },
  { slNo: '128', name: 'O. S. Ambika', gender: 'Female', partyId: 'cpim', constituency: 'Attingal' },
  { slNo: '129', name: 'V. Sasi', gender: 'Male', partyId: 'cpi', constituency: 'Chirayinkeezhu', role: 'Former Deputy Speaker' },
  { slNo: '130', name: 'G. R. Anil', gender: 'Male', partyId: 'cpi', constituency: 'Nedumangad', role: 'Minister for Food & Civil Supplies' },
  { slNo: '131', name: 'D. K. Murali', gender: 'Male', partyId: 'cpim', constituency: 'Vamanapuram' },
  { slNo: '132', name: 'Kadakampally Surendran', gender: 'Male', partyId: 'cpim', constituency: 'Kazhakoottam', role: 'Former Co-operation & Tourism Minister' },
  { slNo: '133', name: 'V. K. Prasanth', gender: 'Male', partyId: 'cpim', constituency: 'Vattiyoorkavu', role: 'Former Trivandrum Mayor' },
  { slNo: '134', name: 'Antony Raju', gender: 'Male', partyId: 'cpim', constituency: 'Thiruvananthapuram', role: 'Former Transport Minister' },
  { slNo: '135', name: 'V. Sivankutty', gender: 'Male', partyId: 'cpim', constituency: 'Nemom', role: 'Minister for General Education & Labour' },
  { slNo: '136', name: 'G. Stephen', gender: 'Male', partyId: 'cpim', constituency: 'Aruvikkara' },
  { slNo: '137', name: 'C. K. Hareendran', gender: 'Male', partyId: 'cpim', constituency: 'Parassala' },
  { slNo: '138', name: 'I. B. Satheesh', gender: 'Male', partyId: 'cpim', constituency: 'Kattakkada' },
  { slNo: '139', name: 'M. Vincent', gender: 'Male', partyId: 'inc', constituency: 'Kovalam' },
  { slNo: '140', name: 'K. A. Ansalan', gender: 'Male', partyId: 'cpim', constituency: 'Neyyattinkara' }
];

export const getPersonsData = (): Person[] => {
  const list: Person[] = [
    {
      id: 'arif-mohammad-khan',
      name: 'Arif Mohammad Khan',
      gender: 'Male',
      partyId: 'independent',
      imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ArifMohammadKhan',
      designations: ['governor'],
      assemblyRoles: {},
      isSuspended: false,
      updatedAt: Date.now()
    }
  ];

  rawMLAs.forEach((mla) => {
    const id = mla.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const assemblyRoles: {[assemblyId: string]: string} = {};
    if (mla.role) {
      assemblyRoles['15th-assembly'] = mla.role;
    }

    list.push({
      id,
      name: mla.name,
      gender: mla.gender,
      partyId: mla.partyId,
      imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(mla.name)}`,
      designations: [],
      assemblyRoles,
      isSuspended: false,
      updatedAt: Date.now()
    });
  });

  return list;
};

export const getConstituenciesData = (): Constituency[] => {
  const list: Constituency[] = [];

  rawMLAs.forEach((mla) => {
    const mlaId = mla.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const conId = `con-${mla.constituency.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
    
    list.push({
      id: conId,
      slNo: mla.slNo,
      name: mla.constituency,
      currentIncumbentId: mlaId,
      currentAssemblyId: '15th-assembly',
      createdInAssemblyId: '15th-assembly',
      history: [],
      updatedAt: Date.now()
    });
  });

  return list;
};

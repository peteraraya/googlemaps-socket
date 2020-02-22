import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { Lugar } from '../../interfaces/lugar';
import { HttpClient } from '@angular/common/http';
import { WebsocketService } from '../../services/websocket.service';


@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.css']
})
export class MapaComponent implements OnInit, AfterViewInit {
  @ViewChild('map', { static: false }) mapaElement: ElementRef;
  // Definición de tipo
  map: google.maps.Map;

  // Referencia : tendré un arreglo de marcadoes
  marcadores : google.maps.Marker[] = [];
  // Manejar cierre dinamico
  infoWindow: google.maps.InfoWindow[] = [];

  lugares: Lugar[] = [];
  
  constructor(
    private http: HttpClient,
    // Inyectamos el servicio
    public wsService: WebsocketService
  ) {}

  ngOnInit() {}

  ngAfterViewInit() {

    this.http.get('http://localhost:5000/mapa-google')
        .subscribe( (lugares:Lugar[]) =>{
            this.lugares = lugares;
            // Cargo aqui los mapas porque las peticiones son asincronas, caso contrario no renderiza
            this.cargarMapa();
        });
  
        this.escucharSocket();


  }

  escucharSocket(){
    // marcador-nuevo
    this.wsService.listen('marcador-nuevo')
        .subscribe( (marcador:Lugar) =>{
          this.agregarMarcador(marcador);
        });

    // marcador-mover
      this.wsService.listen('marcador-mover')
          .subscribe((marcador:Lugar) =>{
            for (const i in this.marcadores) {
              if (this.marcadores[i].getTitle() === marcador.id) {
               
                // para mover algo en googleMaps -> lat - lng

                const latLng = new google.maps.LatLng( marcador.lat, marcador.lng);

                this.marcadores[i].setPosition(latLng);
                break;

              }
            }
          });


    // marcador borrar
    this.wsService.listen('marcador-borrar')
      .subscribe((id: string) => {
        // apuntamos al arreglo de markers
        for (const i in this.marcadores) {
          if (this.marcadores[i].getTitle() === id) {
            // borro el elemento del arreglo
             this.marcadores[i].setMap(null);
            break;
          }
        }
      });

  }



  cargarMapa() {
    // Se crea una latitud y longitud
    const latLng = new google.maps.LatLng(37.784679, -122.395936);

    // Opciones de mapa
    const mapaOpciones: google.maps.MapOptions = {
      center: latLng,
      zoom: 13,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    this.map = new google.maps.Map(
      this.mapaElement.nativeElement,
      mapaOpciones
    );

    this.map.addListener('click', (coors) =>{
      // LLamar a un nuevo marcador agregando una nueva instancia
      const nuevoMarcador: Lugar = {
        nombre: 'Nuevo Lugar',
        lat: coors.latLng.lat(),
        lng: coors.latLng.lng(),
        // necesito un id unico
        id: new Date().toString()
      };
      this.agregarMarcador(nuevoMarcador );

      // Emitir evento socket , agregar-marcador
      this.wsService.emit('marcador-nuevo', nuevoMarcador); // utilizamos el nuevo marcador de payload
    });

    for( const lugar of this.lugares){
       this.agregarMarcador( lugar );
       
    }
  }

  agregarMarcador(marcador: Lugar){

    console.log(marcador);

     const latLng = new google.maps.LatLng(marcador.lat, marcador.lng);

     const marker = new google.maps.Marker({
       map: this.map,
       animation: google.maps.Animation.DROP,
       position: latLng,
       draggable: true,
       title: marcador.id
     });

      // Inserto a un arreglo para tener la referencia de los marcadores
     this.marcadores.push( marker );


    // Info Window
      const contenido = `<strong>${marcador.nombre}</strong>`;

      const infoWindow = new google.maps.InfoWindow({
          content: contenido
      });
      // inserto ventanas
      this.infoWindow.push( infoWindow );

    // Mostrar el info window
    google.maps.event.addDomListener(marker, 'click', (coors) => {
        
      // Recorro infoWindow para cierre dinamico
      this.infoWindow.forEach( infoW => infoW.close());

        infoWindow.open( this.map, marker);
    });  


     // Agregar listener : instancia , elemento que quiero escuchar y callbacks
     google.maps.event.addDomListener( marker, 'dblclick', (coors)=>{
        console.log(coors);

        // Destruimos el marcador
        marker.setMap(null);

        // Disparamos el evento de socket para borrar el marcador
        // marcador-borrar -> utilizamos como payload el marcador.id
        this.wsService.emit('marcador-borrar', marcador.id);
     });

        google.maps.event.addDomListener(marker, "drag", (coors:any) => {
          console.log(coors);

          // Estaemos latitud y longitud
          const nuevoMarcador = {
            nombre: marcador.nombre,
            lat : coors.latLng.lat(),
            lng:  coors.latLng.lng(),
            id: marker.getTitle()
            

          }
            console.log(nuevoMarcador);
          // Disparamos el evento de socket para mover el marcador
          // marcador-mover
          this.wsService.emit('marcador-mover', nuevoMarcador);
        });
  }
}
